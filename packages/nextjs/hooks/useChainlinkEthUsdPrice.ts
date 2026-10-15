"use client";

import { parseAbi } from "viem";
import { sepolia } from "viem/chains";
import { useReadContracts } from "wagmi";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

const feedAddress = "0x694AA1769357215DE4FAC081bf1f309aDC325306" as const;
const feedAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);
const MAX_PRICE_AGE = 2 * 60 * 60;

/** Read the same Sepolia feed as CrowdFund, with no fallback to another price provider. */
export function useChainlinkEthUsdPrice() {
  const { targetNetwork } = useTargetNetwork();
  const supported = targetNetwork.id === sepolia.id;
  const { data, dataUpdatedAt, isError, isPending } = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: feedAddress, abi: feedAbi, functionName: "decimals", chainId: sepolia.id },
      { address: feedAddress, abi: feedAbi, functionName: "latestRoundData", chainId: sepolia.id },
    ],
    query: { enabled: supported, refetchInterval: 5000, refetchIntervalInBackground: true, retry: 1 },
  });
  const decimals = data?.[0];
  const round = data?.[1];
  const now = BigInt(Math.floor(dataUpdatedAt / 1000));
  const valid =
    supported &&
    !isError &&
    decimals !== undefined &&
    decimals <= 18 &&
    round !== undefined &&
    round[1] > 0n &&
    round[3] > 0n &&
    round[3] <= now &&
    now - round[3] <= BigInt(MAX_PRICE_AGE);

  return {
    price: valid ? round[1] * 10n ** BigInt(18 - decimals) : undefined,
    updatedAt: valid ? Number(round[3]) : undefined,
    status: !supported ? "unsupported" : isPending ? "loading" : valid ? "ready" : "unavailable",
  };
}
