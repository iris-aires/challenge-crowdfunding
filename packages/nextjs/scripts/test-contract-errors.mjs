import { getParsedError as getDebugError } from "../node_modules/@scaffold-ui/debug-contracts/dist/esm/utils/getParsedError.js";
import { getParsedError } from "../utils/scaffold-eth/getParsedError.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BaseError, ContractFunctionRevertedError, encodeErrorResult, parseAbi } from "viem";

// Cover every declared custom error, including zero-argument errors and nested RPC causes.
const contracts = ["CrowdFund", "FundingRecipient"].map(name =>
  readFileSync(new URL(`../../foundry/contracts/${name}.sol`, import.meta.url), "utf8"),
);
const signatures = [
  ...new Set(
    contracts.flatMap(source => [...source.matchAll(/error\s+(\w+\([^;]*\));/g)].map(match => `error ${match[1]}`)),
  ),
];
const abi = parseAbi(signatures);
const address = "0x49162053DDE83F81b7b42e7b5ad59370F1d63420";
let cases = 0;
for (const parse of [getParsedError, getDebugError]) {
  for (const item of abi) {
    const args = item.inputs.map(input => (input.type === "address" ? address : 1n));
    const data = encodeErrorResult({ abi, errorName: item.name, args });
    const revert = new ContractFunctionRevertedError({ abi, data, functionName: "execute" });
    const wrapped = new BaseError("The contract function reverted.", { cause: revert });
    const decodedMessage = parse(wrapped);
    assert.ok(decodedMessage.includes(item.name), decodedMessage);
    assert.ok(!decodedMessage.includes("The contract rejected this operation."), decodedMessage);
    assert.ok(!/[\u4e00-\u9fff]/u.test(decodedMessage), decodedMessage);
    // Legacy ABI/RPC data must decode to the same friendly explanation.
    assert.equal(parse({ cause: { data, message: "execution reverted" } }), decodedMessage);
    cases += 2;
  }
  assert.match(parse({ cause: { code: 4001 } }), /cancelled/i);
  assert.match(parse({ name: "InsufficientFundsError" }), /Insufficient ETH/);
  assert.match(parse(new Error("RPC unavailable")), /RPC unavailable/);
  const builtIn = parseAbi(["error Error(string)", "error Panic(uint256)"]);
  for (const [errorName, args] of [
    ["Error", ["Not allowed"]],
    ["Panic", [17n]],
  ]) {
    const data = encodeErrorResult({ abi: builtIn, errorName, args });
    assert.match(
      parse(new ContractFunctionRevertedError({ abi: builtIn, data, functionName: "execute" })),
      errorName === "Error" ? /Not allowed/ : /safety check/,
    );
  }
}
console.log(
  `Passed ${cases} custom-error checks across campaign and debug parsers, plus wallet, RPC, Error(string), and Panic fallbacks.`,
);
