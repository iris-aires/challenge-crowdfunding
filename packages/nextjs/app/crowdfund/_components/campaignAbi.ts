import { parseAbi } from "viem";

// Public interface expected by the campaign UI. Reads are enabled only when
// the deployed ABI includes the function, so an unfinished contract stays usable.
export const campaignReadAbi = parseAbi([
  "function threshold() view returns (uint256)",
  "function balances(address) view returns (uint256)",
  "function openToWithdraw() view returns (bool)",
  "function completed() view returns (bool)",
  "function totalFunded() view returns (uint256)",
  "function fundingRecipient() view returns (address)",
]);
