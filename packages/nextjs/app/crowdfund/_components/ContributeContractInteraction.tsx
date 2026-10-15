"use client";

import { useState } from "react";
import Link from "next/link";
import { ETHToPrice } from "./EthToPrice";
import { campaignReadAbi } from "./campaignAbi";
import { Address } from "@scaffold-ui/components";
import { useWatchBalance } from "@scaffold-ui/hooks";
import humanizeDuration from "humanize-duration";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ArrowTopRightOnSquareIcon, ClockIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

export const ContributeContractInteraction = ({ address }: { address?: string }) => {
  const { address: connectedAddress } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const { data: crowdFundContract } = useDeployedContractInfo({ contractName: "CrowdFund" });
  const { data: fundingRecipientContract } = useDeployedContractInfo({ contractName: "FundingRecipient" });
  const { data: crowdFundContractBalance } = useWatchBalance({ address: crowdFundContract?.address });
  const { data: fundingRecipientBalance } = useWatchBalance({ address: fundingRecipientContract?.address });
  const supportsRead = (name: string) =>
    crowdFundContract?.abi.some(item => item.type === "function" && item.name === name) ?? false;
  const contractReady = supportsRead("threshold") && supportsRead("balances") && supportsRead("openToWithdraw");
  const readOptions = { address: crowdFundContract?.address, abi: campaignReadAbi, chainId: targetNetwork.id } as const;
  const { data: threshold } = useReadContract({
    ...readOptions,
    functionName: "threshold",
    query: { enabled: supportsRead("threshold"), refetchInterval: 3000 },
  });
  const { data: timeLeft } = useScaffoldReadContract({
    contractName: "CrowdFund",
    functionName: "timeLeft",
    watch: true,
  });
  const { data: myContribution } = useReadContract({
    ...readOptions,
    functionName: "balances",
    args: [connectedAddress!],
    query: { enabled: supportsRead("balances") && !!connectedAddress, refetchInterval: 3000 },
  });
  const { data: isFundingCompleted } = useScaffoldReadContract({
    contractName: "FundingRecipient",
    functionName: "completed",
    watch: true,
  });
  const { data: openToWithdraw } = useReadContract({
    ...readOptions,
    functionName: "openToWithdraw",
    query: { enabled: supportsRead("openToWithdraw"), refetchInterval: 3000 },
  });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "CrowdFund" });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const balance = isFundingCompleted ? fundingRecipientBalance?.value : crowdFundContractBalance?.value;
  const progress = balance !== undefined && threshold ? Number((balance * 10000n) / threshold) / 100 : undefined;
  const ready = !!address && timeLeft !== undefined && isFundingCompleted !== undefined && openToWithdraw !== undefined;
  const ended = timeLeft === 0n;
  const status =
    crowdFundContract && !contractReady
      ? "Contract setup incomplete"
      : !ready
        ? "Connecting"
        : isFundingCompleted
          ? "Funded"
          : openToWithdraw
            ? "Refunds available"
            : ended
              ? "Awaiting settlement"
              : "Funding open";
  const transact = async (action: "contribute" | "execute" | "withdraw") => {
    setPendingAction(action);
    try {
      if (action === "contribute") await writeContractAsync({ functionName: "contribute", value: parseEther("0.5") });
      else await writeContractAsync({ functionName: action });
    } catch (error) {
      console.error(`Unable to ${action}`, error);
    } finally {
      setPendingAction(null);
    }
  };
  const disabled = !ready || !connectedAddress || pendingAction !== null;

  return (
    <div className="explorer-page">
      <div className="breadcrumb">
        <Link href="/">Ethereum</Link>
        <span>/</span>
        <span>Crowdfunding</span>
      </div>
      <section className="campaign-hero">
        <div className="campaign-identity">
          <div className="asset-icon" aria-hidden="true">
            Ξ
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1>Community Crowdfund</h1>
              <span className="network-badge">{targetNetwork.name}</span>
            </div>
            <p className="muted mt-2 mb-5">A shared goal. Every contribution onchain.</p>
            <div className="address-caption">Crowdfunding contract</div>
            <div className="contract-address">
              {address ? (
                <Address address={address} chain={targetNetwork} />
              ) : (
                <span className="muted">Contract unavailable on this network</span>
              )}
            </div>
          </div>
        </div>
        <div className="balance-card">
          <div className="flex justify-between items-center gap-3">
            <span className="text-sm font-medium">{isFundingCompleted ? "Total funded" : "Campaign balance"}</span>
            <span className="status-badge">{status}</span>
          </div>
          <div className="balance-value">
            <ETHToPrice value={balance !== undefined ? formatEther(balance) : undefined} />
          </div>
          <div
            className="funding-progress"
            role="progressbar"
            aria-label="Funding target progress"
            aria-valuenow={progress === undefined ? undefined : Math.min(progress, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${Math.min(progress ?? 0, 100)}%` }} />
          </div>
          <div className="flex justify-between text-xs gap-4">
            <span>{progress === undefined ? "—" : `${progress.toFixed(1)}% funded`}</span>
            <span>Target: {threshold === undefined ? "—" : formatEther(threshold)} ETH</span>
          </div>
        </div>
      </section>

      <section className="summary-section">
        <div>
          <h2>Summary</h2>
          <p className="muted summary-copy">
            Contribute ETH toward a common goal. If the funding target is reached, the recipient receives the funds
            after the deadline. Otherwise, contributors can claim a refund.
          </p>
        </div>
        <dl className="stat-grid">
          <div>
            <dt>Funding target</dt>
            <dd>{threshold === undefined ? "—" : formatEther(threshold)} ETH</dd>
            <span className="muted text-xs">All-or-nothing funding</span>
          </div>
          <div>
            <dt>Time remaining</dt>
            <dd>
              {timeLeft === undefined
                ? "—"
                : ended
                  ? "Ended"
                  : humanizeDuration(Number(timeLeft) * 1000, { largest: 2, round: true })}
            </dd>
            <span className="muted text-xs">{ended ? "Campaign deadline reached" : "Until campaign deadline"}</span>
          </div>
          <div>
            <dt>Your contribution</dt>
            <dd>{!connectedAddress || myContribution === undefined ? "—" : formatEther(myContribution)} ETH</dd>
            <span className="muted text-xs">{connectedAddress ? "Connected wallet" : "Connect a wallet to view"}</span>
          </div>
          <div>
            <dt>Recipient</dt>
            <dd className="recipient-address">
              <Address address={fundingRecipientContract?.address} chain={targetNetwork} />
            </dd>
            <span className="muted text-xs">Funding recipient contract</span>
          </div>
        </dl>
      </section>

      <section className="action-section">
        <div>
          <div className="eyebrow">PARTICIPATE</div>
          <h2>Make a contribution.</h2>
          <p className="muted">Support this campaign directly from your wallet.</p>
          <Link href="/contributions" className="inline-flex items-center gap-2 text-sm font-medium mt-3">
            View all contributions <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className="contribution-card">
          <div className="flex justify-between items-center">
            <span className="muted text-sm">Contribution amount</span>
            <span className="network-badge">ETH</span>
          </div>
          <div className="contribution-amount">
            0.5 <span>ETH</span>
          </div>
          <button
            className="btn btn-primary w-full"
            disabled={disabled || ended || !!isFundingCompleted || !!openToWithdraw}
            onClick={() => transact("contribute")}
          >
            {pendingAction === "contribute" ? "Confirming…" : "Contribute 0.5 ETH"}
          </button>
          <p className="muted text-xs text-center" role="status">
            {crowdFundContract && !contractReady
              ? "The deployed contract is missing campaign functions. Complete the contract and redeploy to enable funding."
              : !connectedAddress
                ? "Connect your wallet to participate."
                : !ready
                  ? "Waiting for campaign data. Check your network connection."
                  : isFundingCompleted
                    ? "This campaign has been successfully funded."
                    : openToWithdraw
                      ? "Funding target not met. You can withdraw your contribution."
                      : ended
                        ? "The deadline has passed. Settle the campaign below."
                        : "Your contribution is recorded on Ethereum."}
          </p>
          <div className="settlement-actions">
            <button
              className="btn btn-outline btn-sm"
              disabled={disabled || !ended || !!isFundingCompleted || !!openToWithdraw}
              onClick={() => transact("execute")}
            >
              {pendingAction === "execute" ? "Settling…" : "Settle campaign"}
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={disabled || !openToWithdraw || !myContribution || !!isFundingCompleted}
              onClick={() => transact("withdraw")}
            >
              {pendingAction === "withdraw" ? "Withdrawing…" : "Withdraw funds"}
            </button>
          </div>
        </div>
      </section>
      <div className="trust-note">
        <ShieldCheckIcon className="h-5 w-5" />
        <span>Funds are governed by the smart contract.</span>
        <ClockIcon className="h-4 w-4 ml-auto" />
        <span>Live onchain data</span>
      </div>
    </div>
  );
};
