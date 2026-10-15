"use client";

import Link from "next/link";
import { useFetchNativeCurrencyPrice } from "@scaffold-ui/hooks";
import { hardhat } from "viem/chains";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const { price } = useFetchNativeCurrencyPrice();
  return (
    <footer className="site-footer">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-semibold">Crowdfund</span>
        <span className="muted">Transparent funding. On Ethereum.</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {price > 0 && (
          <span className="muted">ETH ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        )}
        {targetNetwork.id === hardhat.id && (
          <>
            <Faucet />
            <Link href="/blockexplorer" className="link">
              Block Explorer
            </Link>
          </>
        )}
      </div>
    </footer>
  );
};
