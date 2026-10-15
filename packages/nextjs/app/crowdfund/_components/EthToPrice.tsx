import { parseEther } from "viem";
import { useChainlinkEthUsdPrice } from "~~/hooks/useChainlinkEthUsdPrice";
import { formatUsdAmount } from "~~/utils/crowdfunding";

type TBalanceProps = {
  value?: string;
  className?: string;
};

/** Display ETH and its Chainlink USD estimate together. */
export const ETHToPrice = ({ value, className = "" }: TBalanceProps) => {
  const { price } = useChainlinkEthUsdPrice();
  if (value === undefined) return <span className="animate-pulse">— ETH</span>;
  const amount = parseEther(value);
  return (
    <div className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${className}`}>
      <span>{Number(value).toLocaleString("en-US", { maximumFractionDigits: 4 })} ETH</span>
      <span className="muted text-base font-normal">
        {price === undefined ? "USD estimate unavailable" : `≈ ${formatUsdAmount(amount, price)} USD`}
      </span>
    </div>
  );
};
