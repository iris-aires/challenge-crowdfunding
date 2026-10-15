import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const helper = new URL("../node_modules/@scaffold-ui/debug-contracts/dist/esm/utils/formatDeadline.js", import.meta.url)
  .href;
const timestamp = BigInt(Date.UTC(2027, 0, 1) / 1000);
for (const [zone, expected] of [
  ["Asia/Shanghai", "2027-01-01"],
  ["Europe/Paris", "2027-01-01"],
  ["America/Los_Angeles", "2026-12-31"],
]) {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {formatDeadline} from ${JSON.stringify(helper)}; console.log(JSON.stringify(formatDeadline(${timestamp}n)));`,
    ],
    { env: { ...process.env, TZ: zone }, encoding: "utf8" },
  );
  const result = JSON.parse(output);
  assert.equal(result.text, expected);
  assert.equal(result.dateTime, "2027-01-01T00:00:00.000Z");
  assert.ok(result.title.includes(zone));
  assert.ok(result.title.includes(timestamp.toString()));
}
const { formatDeadline } = await import(helper);
assert.equal(formatDeadline(undefined), undefined);
assert.equal(formatDeadline(-1n), undefined);
assert.equal(formatDeadline(2n ** 256n - 1n), undefined);
console.log(
  "Deadline display passed for Asian, European, and American timezones, including date rollover and invalid values.",
);
