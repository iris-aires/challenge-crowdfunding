// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { CrowdFund } from "../contracts/CrowdFund.sol";
import { FundingRecipient } from "../contracts/FundingRecipient.sol";

contract CrowdFundDeadlineTest is Test {
    CrowdFund internal crowd;
    address internal admin = 0x49162053DDE83F81b7b42e7b5ad59370F1d63420;

    event DeadlineUpdated(uint256 previousDeadline, uint256 newDeadline);

    function setUp() public {
        vm.warp(1_800_000_000);
        crowd = new CrowdFund(address(new FundingRecipient()));
        vm.deal(address(this), 20 ether);
    }

    function test_AdminSetsTwelveDaysFromCurrentTimeAndEmitsEvent() public {
        uint256 previous = crowd.deadline();
        vm.warp(block.timestamp + 3 days);
        uint256 expected = block.timestamp + 12 days;
        vm.expectEmit(false, false, false, true, address(crowd));
        emit DeadlineUpdated(previous, expected);
        vm.prank(admin);
        crowd.updateDeadline(12);
        assertEq(crowd.deadline(), expected);
        assertEq(crowd.timeLeft(), 12 days);
    }

    function testFuzz_NonAdminCannotChangeDeadline(address caller, uint256 daysFromNow) public {
        vm.assume(caller != admin);
        uint256 previous = crowd.deadline();
        vm.prank(caller);
        vm.expectRevert(CrowdFund.NotAdmin.selector);
        crowd.updateDeadline(daysFromNow);
        assertEq(crowd.deadline(), previous);
    }

    function test_ZeroDaysEndsImmediatelyAndAllowsSettlement() public {
        crowd.contribute{value: 10 ether}();
        vm.prank(admin);
        crowd.updateDeadline(0);
        assertEq(crowd.timeLeft(), 0);
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.ContributionClosed.selector, block.timestamp));
        crowd.contribute{value: 0.1 ether}();
        crowd.execute();
        assertTrue(crowd.completed());
    }

    function test_ExpiredUnsettledCampaignCanBeExtended() public {
        vm.warp(crowd.deadline() + 1);
        vm.prank(admin);
        crowd.updateDeadline(12);
        crowd.contribute{value: 1 ether}();
        assertEq(crowd.timeLeft(), 12 days);
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.TooEarly.selector, crowd.deadline(), block.timestamp));
        crowd.execute();
    }

    function test_SuccessCannotBeReopened() public {
        crowd.contribute{value: 10 ether}();
        vm.warp(crowd.deadline());
        crowd.execute();
        vm.prank(admin);
        vm.expectRevert(CrowdFund.AlreadyCompleted.selector);
        crowd.updateDeadline(12);
    }

    function test_RefundsCannotBeClosedByChangingDeadline() public {
        crowd.contribute{value: 1 ether}();
        vm.warp(crowd.deadline());
        crowd.execute();
        vm.prank(admin);
        vm.expectRevert(CrowdFund.AlreadySettled.selector);
        crowd.updateDeadline(12);
        crowd.withdraw();
        assertEq(address(crowd).balance, 0);
    }

    function test_OverflowUsesDescriptiveCustomError() public {
        uint256 previous = crowd.deadline();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.InvalidDeadlineDays.selector, type(uint256).max));
        crowd.updateDeadline(type(uint256).max);
        assertEq(crowd.deadline(), previous);
    }

    receive() external payable { }
}
