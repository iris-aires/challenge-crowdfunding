import {
  formatDebugValue,
  formatUsdValue,
  parseEthInput,
} from "../node_modules/@scaffold-ui/debug-contracts/dist/esm/utils/ethUsdDisplay.js";
import assert from "node:assert/strict";
import { maxUint256, parseEther } from "viem";

assert.equal(parseEthInput("1"), parseEther("1"));
assert.equal(parseEthInput("0.01"), parseEther("0.01"));
assert.equal(parseEthInput("0.000000000000000001"), 1n);
assert.equal(parseEthInput("0"), 0n);
for (const invalid of ["", "-1", "1e18", "NaN", "1.0000000000000000001", maxUint256.toString()]) {
  assert.equal(parseEthInput(invalid), undefined);
}
assert.equal(formatUsdValue(parseEther("2369.42584906")), "$2,369.42 USD");
assert.equal(formatUsdValue(parseEther("23.6942584906")), "$23.69 USD");
assert.equal(formatUsdValue(0n), "$0.00 USD");
assert.equal(formatDebugValue("threshold", parseEther("10")), "10 ETH");
assert.equal(formatDebugValue("totalFunded", parseEther("1.5")), "1.5 ETH");
assert.equal(formatDebugValue("totalFunded", 0n), "0 ETH");
assert.equal(formatDebugValue("timeLeft", 86400n), "1 day");
assert.equal(formatDebugValue("timeLeft", 43200n), "0.5 days");
assert.equal(formatDebugValue("timeLeft", 1n), "0.01 days");
assert.equal(formatDebugValue("timeLeft", 0n), "0 days");
assert.equal(formatDebugValue("MAX_PRICE_AGE", 7200n), undefined);
console.log("Debug ETH/USD conversion, precision, invalid amounts, and ETH/day formatting passed.");
