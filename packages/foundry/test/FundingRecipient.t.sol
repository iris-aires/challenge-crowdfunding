// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { Test } from "forge-std/Test.sol";
import { FundingRecipient } from "../contracts/FundingRecipient.sol";
import { CrowdFund } from "../contracts/CrowdFund.sol";

contract RejectRecipientPayment {
    receive() external payable {
        revert();
    }
}

contract FundingRecipientTest is Test {
    FundingRecipient internal recipient;
    address internal beneficiary;

    function setUp() public {
        recipient = new FundingRecipient();
        beneficiary = recipient.BENEFICIARY();
        vm.deal(address(this), 20 ether);
    }

    function testFuzz_UnauthorizedCannotWithdraw(address caller) public {
        vm.assume(caller != beneficiary);
        recipient.complete{value: 1 ether}();

        vm.expectRevert(abi.encodeWithSelector(FundingRecipient.Unauthorized.selector, caller));
        vm.prank(caller);
        recipient.withdraw();

        assertEq(address(recipient).balance, 1 ether);
    }

    function test_BeneficiaryWithdrawsAllDepositsAndCompletionStaysTrue() public {
        recipient.complete{value: 1 ether}();
        recipient.complete{value: 0.5 ether}();
        uint256 startingBalance = beneficiary.balance;

        vm.prank(beneficiary);
        recipient.withdraw();

        assertEq(beneficiary.balance, startingBalance + 1.5 ether);
        assertEq(address(recipient).balance, 0);
        assertTrue(recipient.completed());
    }

    function test_RepeatedWithdrawalDoesNotPayMore() public {
        recipient.complete{value: 1 ether}();
        vm.prank(beneficiary);
        recipient.withdraw();
        uint256 balanceAfterWithdrawal = beneficiary.balance;

        vm.prank(beneficiary);
        recipient.withdraw();

        assertEq(beneficiary.balance, balanceAfterWithdrawal);
    }

    function test_FailedTransferPreservesFunds() public {
        recipient.complete{value: 1 ether}();
        RejectRecipientPayment rejectingReceiver = new RejectRecipientPayment();
        vm.etch(beneficiary, address(rejectingReceiver).code);

        vm.expectRevert(
            abi.encodeWithSelector(FundingRecipient.WithdrawTransferFailed.selector, beneficiary, 1 ether)
        );
        vm.prank(beneficiary);
        recipient.withdraw();

        assertEq(address(recipient).balance, 1 ether);
        assertTrue(recipient.completed());
    }

    function test_CrowdFundSuccessCanBeWithdrawnWithoutReopeningCampaign() public {
        CrowdFund crowdFund = new CrowdFund(address(recipient));
        crowdFund.contribute{value: 10 ether}();
        vm.warp(crowdFund.deadline() + 1);
        crowdFund.execute();
        uint256 startingBalance = beneficiary.balance;

        vm.prank(beneficiary);
        recipient.withdraw();

        assertEq(beneficiary.balance, startingBalance + 10 ether);
        assertEq(address(recipient).balance, 0);
        vm.expectRevert(CrowdFund.AlreadyCompleted.selector);
        crowdFund.contribute{value: 0.1 ether}();
    }
}
