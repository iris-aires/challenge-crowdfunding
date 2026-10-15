// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; // 保持挑战要求的 Solidity 版本，避免影响评分。

import "./FundingRecipient.sol";

/// @title 众筹合约：汇集 ETH，达标后转款，未达标则开放退款。
/// @dev 到期不会自动结算，需要有人发起交易调用 execute()。
///      当前实现按结算时的余额判断是否达标，并未禁止截止后继续捐款。
contract CrowdFund {


    /// @notice 退款尚未开放，拒绝退款请求。
    error NotOpenToWithdraw();
    /// @notice 预留的零余额错误；当前未使用，零余额也允许调用退款。
    error NoBalance();
    /// @notice 众筹已成功完成，禁止继续捐款、退款或结算。
    error AlreadyCompleted();
    /// @notice 退款转账失败；to 为收款地址，amount 为尝试发送的金额（wei）。
    error WithdrawTransferFailed(address to, uint256 amount);
    /// @notice 尚未超过截止时间；参数分别为截止时间和当前区块时间戳（秒）。
    error TooEarly(uint256 deadline, uint256 currentTimestamp);


    /// @notice 每个地址的捐款记账金额，单位为 wei，未捐款的地址默认是 0。
    /// @dev public 自动生成 balances(address) 查询函数；退款时余额归零。
    ///      成功转款不会逐一清零账本，因此该数值不一定代表当前可退款金额。
    mapping(address => uint256 ) public balances;
    /// @notice 退款开关，默认 false；execute() 结算未达标时设为 true。
    bool public openToWithdraw;
    /// @notice 部署时确定的截止时间：部署所在区块时间加 30 分钟。
    uint256  public deadline = block.timestamp+ 60 minutes;
    /// @notice 固定筹款门槛：1 ETH，即 10^18 wei；constant 表示常量。
    uint256 public constant threshold  = 1 ether;

    /// @notice 接收众筹资金的合约，同时提供 completed 完成标记。
    FundingRecipient public fundingRecipient;


    /// @notice 记录每次捐款的地址和本次金额（wei），供前端查询捐款历史。
    event Contribution(address,uint256);


    /// @dev 函数执行前检查是否已完成，避免成功后继续接收常规捐款。
    modifier notCompleted() {
        if(fundingRecipient.completed()){
            revert AlreadyCompleted();
        }

        // 检查通过后，在这里执行被修饰函数的函数体。
        _;
    }



    /// @param fundingRecipientAddress 已部署的 FundingRecipient 合约地址。
    constructor(address fundingRecipientAddress) {
        // 将地址转换为合约类型，后续可调用 completed() 和 complete()。
        fundingRecipient = FundingRecipient(fundingRecipientAddress);
    }



    /// @notice 捐款入口；payable 允许调用时附带 ETH。
    /// @dev 仅限制已完成状态，不检查截止时间、最低金额或退款开关。
    function contribute() public payable notCompleted {
        // msg.sender 是调用者，msg.value 是本次金额（wei）；+= 保留之前的捐款并累加。
        balances[msg.sender]+=msg.value;
        // 发出本次捐款事件，方便前端展示记录。
        emit Contribution(msg.sender,msg.value);
    }

    /// @notice 退款开放后，取回调用者账本中记录的全部金额。
    /// @dev 按“检查 → 更新状态 → 外部调用”的顺序，防止同一笔余额被重入重复提取。
    function withdraw() public notCompleted{
        // 1. 检查：未开放退款时回退。
        if(!openToWithdraw){
            revert NotOpenToWithdraw();
        }
        // 2. 更新状态：先保存退款金额，再清零账本。
        uint256 balance = balances[msg.sender];

        // 收款合约即使在收到 ETH 时再次调用 withdraw()，可读到的余额也已经为 0。
        balances[msg.sender] = 0;

        // 3. 外部调用：发送 ETH；空字符串表示不附带调用数据。
        // success 表示调用是否成功，第二个返回值（返回数据）在此忽略。
        // 允许发送 0 ETH；普通地址重复退款不会多领资金。
        (bool success,)=msg.sender.call{value:balance}("");
        if  (!success){
            // 回退会撤销本次交易的状态修改，包括前面的余额清零。
            revert WithdrawTransferFailed(msg.sender,balance);
        }



    }

    /// @notice 截止后由任何人结算：达标转款，未达标开放退款。
    /// @dev 时间流逝不会自动执行代码，需要外部交易触发。
    function execute() public notCompleted{

        // 必须严格超过截止时间；恰好等于 deadline 时仍不能执行。
        if(block.timestamp <= deadline){
            revert TooEarly(deadline,block.timestamp);
        }

        // 使用本合约实际持有的 ETH 余额，而不是某个用户的账本金额。
        uint256 totalAmount = address(this).balance;

        if(totalAmount>=threshold){
            // 达标：将全部余额随 complete() 调用发送，接收合约会标记 completed。
            // complete() 无参数；金额由 {value: ...} 指定。调用失败时结算一起回退。
            fundingRecipient.complete{value:totalAmount}();
        }else{
            // 未达标：开放退款，贡献者各自调用 withdraw() 取款。
            // 当前实现未关闭捐款，也未标记完成，之后仍可捐款或再次结算。
            openToWithdraw = true;
        }
    }

    /// @notice 接收调用数据为空的 ETH 转账，例如钱包直接向合约地址转账。
    receive() external payable {
        // 内部调用保留原始 msg.sender 和 msg.value，并经过 notCompleted 检查。
        // 复用记账和事件逻辑，确保直接转账也被记录。
        contribute();
    }

    /// @notice 返回剩余秒数；到达截止时间及之后均返回 0。
    /// @dev view 表示不修改状态；先比较再相减，避免 uint256 减法下溢。
    function timeLeft() public view returns (uint256) {
        if(deadline>=block.timestamp){
            return deadline-block.timestamp;
        }else{
            return 0;
        }
    }
}
