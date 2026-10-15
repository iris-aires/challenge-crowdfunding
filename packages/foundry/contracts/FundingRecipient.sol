// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; // Do not change the solidity version as it negatively impacts submission grading

contract FundingRecipient {
    /// @notice 只有固定受益人可以提现；部署者不会自动获得提现权限。
    error Unauthorized(address caller);
    error WithdrawTransferFailed(address to, uint256 amount);

    /// @notice 唯一允许提现的地址，同时也是资金的固定接收地址。
    address public constant BENEFICIARY = 0x49162053DDE83F81b7b42e7b5ad59370F1d63420;

    event Withdrawal(address indexed to, uint256 amount);

    bool public completed;

    function complete() public payable {
        completed = true;
    }

    /// @notice 由受益人发起，将本合约持有的全部 ETH 转入受益人地址。
    /// @dev 保留 completed 标记，提现后不会重新开放 CrowdFund 的捐款入口。
    function withdraw() public {
        if (msg.sender != BENEFICIARY) revert Unauthorized(msg.sender);

        uint256 amount = address(this).balance;
        (bool success,) = payable(BENEFICIARY).call{value: amount}("");
        if (!success) revert WithdrawTransferFailed(BENEFICIARY, amount);

        emit Withdrawal(BENEFICIARY, amount);
    }
}
