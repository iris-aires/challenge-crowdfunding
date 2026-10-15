import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { parse } from "toml";

config();

const args = process.argv.slice(2);
let network = "localhost";
if (args.length === 1 && !args[0].startsWith("-")) {
  network = args[0];
} else if (args.length === 2 && args[0] === "--network") {
  network = args[1];
} else if (args.length !== 0) {
  console.error("Usage: yarn verify [network] OR yarn verify --network <network>");
  process.exit(1);
}

const foundryConfig = parse(readFileSync("foundry.toml", "utf8"));
if (!Object.hasOwn(foundryConfig.rpc_endpoints ?? {}, network)) {
  console.error("Unknown network. Check rpc_endpoints in foundry.toml.");
  process.exit(1);
}

const result = spawnSync("make", ["verify", `RPC_URL=${network}`], {
  stdio: "inherit",
});
if (result.error) console.error("Could not start verification:", result.error.message);
process.exitCode = result.status ?? 1;
