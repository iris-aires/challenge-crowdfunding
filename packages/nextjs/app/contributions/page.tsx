"use client";

import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { useQuery } from "@tanstack/react-query";
import type { NextPage } from "next";
import { formatEther, parseAbiItem } from "viem";
import { usePublicClient } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

const ContributionsPage: NextPage = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: contract, isLoading: contractLoading } = useDeployedContractInfo({ contractName: "CrowdFund" });
  const client = usePublicClient({ chainId: targetNetwork.id });
  const supportsEvents = contract?.abi.some(item => (item.type as string) === "event") ?? false;
  const {
    data: contributionEvents,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["campaign-contributions", targetNetwork.id, contract?.address],
    enabled: !!client && !!contract && supportsEvents,
    refetchInterval: 3000,
    queryFn: async () =>
      client!.getLogs({
        address: contract!.address,
        event: parseAbiItem("event Contribution(address, uint256)"),
        fromBlock: BigInt(contract!.deployedOnBlock ?? 0),
        toBlock: "latest",
      }),
  });
  return (
    <div className="explorer-page">
      <div className="breadcrumb">
        <Link href="/">Ethereum</Link>
        <span>/</span>
        <span>Contributions</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Contributions</h1>
          <p className="muted text-sm">Every contribution, recorded onchain.</p>
        </div>
        <span className="network-badge">{targetNetwork.name}</span>
      </div>
      <div className="table-panel overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Contributor</th>
              <th>Amount</th>
              <th>Block</th>
            </tr>
          </thead>
          <tbody>
            {isLoading || contractLoading ? (
              <tr>
                <td colSpan={3} className="empty-state">
                  <span className="loading loading-spinner loading-md" />
                  <p className="muted" role="status">
                    Loading contributions…
                  </p>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className="empty-state">
                  <h2>Unable to load contributions.</h2>
                  <p className="muted">Check your network connection and contract deployment.</p>
                </td>
              </tr>
            ) : contract && !supportsEvents ? (
              <tr>
                <td colSpan={3} className="empty-state">
                  <h2>Contribution history unavailable.</h2>
                  <p className="muted">The deployed contract does not yet emit contribution events.</p>
                </td>
              </tr>
            ) : !contributionEvents?.length ? (
              <tr>
                <td colSpan={3} className="empty-state">
                  <h2>
                    This campaign has
                    <br />
                    no contributions yet.
                  </h2>
                  <p className="muted">Be the first to support this shared goal.</p>
                  <Link href="/crowdfund" className="btn btn-primary btn-sm mt-3">
                    Explore campaign
                  </Link>
                </td>
              </tr>
            ) : (
              contributionEvents.map(event => (
                <tr key={`${event.transactionHash}-${event.logIndex}`}>
                  <td>
                    <Address address={event.args?.[0]} chain={targetNetwork} />
                  </td>
                  <td className="font-mono">{formatEther(event.args?.[1] || 0n)} ETH</td>
                  <td className="muted font-mono">{event.blockNumber?.toString() ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default ContributionsPage;
