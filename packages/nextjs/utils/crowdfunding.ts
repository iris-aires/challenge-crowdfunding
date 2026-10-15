import { parseEther } from "viem";

export const MIN_CONTRIBUTION = parseEther("0.01");
export const MAX_CONTRIBUTION = parseEther("1000");

/** Reject exponent notation and extra decimal places before parsing. */
export function parseContributionAmount(value: string): bigint | undefined {
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(value)) return undefined;
  const amount = parseEther(value);
  return amount >= MIN_CONTRIBUTION && amount <= MAX_CONTRIBUTION ? amount : undefined;
}

/** Both inputs use 18 decimals. Keep integer precision until rounding down to cents. */
export function formatUsdAmount(weiAmount: bigint, ethUsdPrice: bigint): string {
  const cents = (weiAmount * ethUsdPrice) / 10n ** 34n;
  return `$${(cents / 100n).toLocaleString("en-US")}.${(cents % 100n).toString().padStart(2, "0")}`;
}
