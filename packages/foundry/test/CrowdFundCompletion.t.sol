// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { CrowdFund } from "../contracts/CrowdFund.sol";
import { FundingRecipient } from "../contracts/FundingRecipient.sol";

contract CrowdFundCompletionTest is Test {
    FundingRecipient internal recipient;
    CrowdFund internal crowd;
    address internal attacker = address(0xBAD);

    function setUp() public {
        recipient = new FundingRecipient();
        crowd = new CrowdFund(address(recipient));
        vm.deal(address(this), 20 ether);
    }

    function prematurelyCompleteRecipient() internal {
        vm.prank(attacker);
        recipient.complete();
        assertTrue(recipient.completed());
        assertFalse(crowd.completed());
    }

    function test_ExternalCompletionBeforeContributionDoesNotBlockFunding() public {
        prematurelyCompleteRecipient();
        crowd.contribute{value: 10.5 ether}();
        vm.warp(crowd.deadline() + 1);
        crowd.execute();
        assertTrue(crowd.completed());
        assertEq(address(crowd).balance, 0);
        assertEq(address(recipient).balance, 10.5 ether);
        vm.prank(recipient.BENEFICIARY());
        recipient.withdraw();
        assertEq(address(recipient).balance, 0);
        assertEq(recipient.BENEFICIARY().balance, 10.5 ether);
    }

    function test_ExternalCompletionAfterContributionDoesNotBlockSettlement() public {
        crowd.contribute{value: 10.5 ether}();
        prematurelyCompleteRecipient();
        vm.warp(crowd.deadline() + 1);
        crowd.execute();
        assertTrue(crowd.completed());
        assertEq(address(recipient).balance, 10.5 ether);
    }

    function test_ExternalCompletionDoesNotBlockRefunds() public {
        crowd.contribute{value: 0.5 ether}();
        prematurelyCompleteRecipient();
        vm.warp(crowd.deadline() + 1);
        crowd.execute();
        assertTrue(crowd.openToWithdraw());
        prematurelyCompleteRecipient();
        uint256 beforeRefund = address(this).balance;
        crowd.withdraw();
        assertEq(address(this).balance, beforeRefund + 0.5 ether);
        assertEq(crowd.balances(address(this)), 0);
        assertEq(address(crowd).balance, 0);
    }

    function test_SuccessBlocksRepeatedSettlementAndNewContributions() public {
        crowd.contribute{value: 10 ether}();
        vm.warp(crowd.deadline() + 1);
        crowd.execute();
        vm.expectRevert(CrowdFund.AlreadyCompleted.selector);
        crowd.execute();
        vm.expectRevert(CrowdFund.AlreadyCompleted.selector);
        crowd.contribute{value: 0.1 ether}();
        vm.expectRevert(CrowdFund.AlreadyCompleted.selector);
        crowd.withdraw();
        (bool accepted,) = address(crowd).call{value: 0.1 ether}("");
        assertFalse(accepted);
        assertEq(address(recipient).balance, 10 ether);
    }

    function test_TargetAndDuration() public view {
        assertEq(crowd.threshold(), 10 ether);
        assertEq(crowd.deadline(), block.timestamp + 365 days);
    }

    function test_DeadlineBoundaryClosesContributionsAndAllowsSettlement() public {
        crowd.contribute{value: 10 ether}();
        vm.warp(crowd.deadline());
        assertEq(crowd.timeLeft(), 0);
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.ContributionClosed.selector, crowd.deadline()));
        crowd.contribute{value: 0.1 ether}();
        (bool accepted,) = address(crowd).call{value: 0.1 ether}("");
        assertFalse(accepted);
        crowd.execute();
        assertTrue(crowd.completed());
        assertEq(crowd.totalFunded(), 10 ether);
    }

    function test_RefundSettlementCannotBeChangedByForcedEther() public {
        crowd.contribute{value: 0.5 ether}();
        vm.warp(crowd.deadline());
        crowd.execute();
        vm.deal(address(crowd), 10 ether);
        vm.expectRevert(CrowdFund.AlreadySettled.selector);
        crowd.execute();
        crowd.withdraw();
        assertEq(crowd.balances(address(this)), 0);
        assertFalse(crowd.completed());
    }

    function test_RecipientWithdrawalDoesNotEraseHistoricalFunding() public {
        crowd.contribute{value: 10 ether}();
        vm.warp(crowd.deadline());
        crowd.execute();
        vm.prank(recipient.BENEFICIARY());
        recipient.withdraw();
        assertEq(crowd.totalFunded(), 10 ether);
        assertEq(address(recipient).balance, 0);
    }

    function test_InvalidRecipientRejected() public {
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.InvalidRecipient.selector, address(0)));
        new CrowdFund(address(0));
        vm.expectRevert(abi.encodeWithSelector(CrowdFund.InvalidRecipient.selector, attacker));
        new CrowdFund(attacker);
    }

    function test_FailedRecipientCallRollsBackCompletionAndPreservesFunds() public {
        crowd.contribute{value: 10 ether}();
        vm.warp(crowd.deadline() + 1);
        vm.mockCallRevert(address(recipient), abi.encodeCall(FundingRecipient.complete, ()), abi.encode("failed"));
        vm.expectRevert();
        crowd.execute();
        assertFalse(crowd.completed());
        assertEq(address(crowd).balance, 10 ether);
        vm.clearMockedCalls();
        crowd.execute();
        assertTrue(crowd.completed());
        assertEq(address(recipient).balance, 10 ether);
    }

    receive() external payable { }
}
