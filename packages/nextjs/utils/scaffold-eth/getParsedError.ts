import { BaseError as BaseViemError, ContractFunctionRevertedError, decodeErrorResult, parseAbi } from "viem";

// Keep custom error decoding available even when the deployed ABI is older.
const errorMessages = {
  NotAdmin: "Not Admin. Only the designated administrator can change the campaign deadline.",
  InvalidDeadlineDays: "The number of days is too large. Enter a smaller whole number of days.",
  AlreadyCompleted: "Campaign already completed. Contributions, settlement, and refunds are closed.",
  AlreadySettled: "This campaign has already been settled for refunds. It cannot be settled again.",
  ContributionClosed: "The contribution period has ended. New contributions are no longer accepted.",
  NotOpenToWithdraw: "Refunds are not available. Settle the campaign after the deadline first.",
  NoBalance: "You have no contribution balance available to withdraw.",
  TooEarly: "The campaign deadline has not been reached. Settlement is not available yet.",
  Unauthorized: "Only the designated beneficiary can withdraw funds from this recipient contract.",
  WithdrawTransferFailed:
    "ETH transfer failed. The funds remain in the contract. Check that the receiving wallet accepts ETH.",
  InvalidRecipient: "The funding recipient must be a deployed contract at a valid address.",
  InvalidOraclePrice: "Chainlink returned an invalid or incomplete ETH/USD price. Please try again later.",
  StaleOraclePrice: "The Chainlink ETH/USD price is more than two hours old. USD estimates are unavailable.",
  UnsupportedOracleDecimals: "The price feed uses an unsupported decimal precision.",
};
const errorAbi = parseAbi([
  "error NotAdmin()",
  "error InvalidDeadlineDays(uint256 daysFromNow)",
  "error AlreadyCompleted()",
  "error AlreadySettled()",
  "error ContributionClosed(uint256 deadline)",
  "error NotOpenToWithdraw()",
  "error NoBalance()",
  "error TooEarly(uint256 deadline, uint256 currentTimestamp)",
  "error Unauthorized(address caller)",
  "error WithdrawTransferFailed(address to, uint256 amount)",
  "error InvalidRecipient(address recipient)",
  "error InvalidOraclePrice()",
  "error StaleOraclePrice(uint256 updatedAt)",
  "error UnsupportedOracleDecimals(uint8 decimals)",
]);

/** Prefer decoded revert data over generic RPC details, including nested causes. */
export const getParsedError = (error: any): string => {
  const causes: any[] = [];
  const seen = new Set();
  for (let cause = error; cause && !seen.has(cause); cause = cause.cause) {
    seen.add(cause);
    causes.push(cause);
  }
  // viem can keep the decoded reason above the deepest RPC cause.
  for (const cause of causes) {
    let decoded = cause instanceof ContractFunctionRevertedError ? cause.data : undefined;
    if (!decoded && typeof cause.data === "string" && /^0x[0-9a-f]+$/i.test(cause.data)) {
      try {
        decoded = decodeErrorResult({ abi: errorAbi, data: cause.data });
      } catch {
        // Unknown selectors fall back to the provider's error message below.
      }
    }
    if (decoded) {
      const { errorName, args } = decoded;
      if (errorName === "Error") return `Transaction reverted: ${String(args?.[0] ?? "Unknown reason")}`;
      if (errorName === "Panic") {
        return `Contract execution failed an internal safety check (Panic: ${String(args?.[0])}).`;
      }
      const explanation = errorMessages[errorName as keyof typeof errorMessages];
      return `${explanation ?? "The contract rejected this operation."} (${errorName}${args?.length ? `: ${args.map(String).join(", ")}` : ""})`;
    }
  }
  if (causes.some(cause => cause.code === 4001 || cause.name === "UserRejectedRequestError")) {
    return "Transaction cancelled. You rejected the request in your wallet.";
  }
  if (causes.some(cause => cause.name === "InsufficientFundsError")) {
    return "Insufficient ETH to cover the transaction value and gas fee.";
  }
  const parsedError = error instanceof BaseViemError ? error : causes.at(-1);
  return parsedError?.shortMessage ?? parsedError?.message ?? "An unknown error occurred. Please try again.";
};
