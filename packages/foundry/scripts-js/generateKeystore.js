import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import readline from "readline";
import { fileURLToPath } from "url";

async function createKeystore() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await new Promise((resolve) => {
      rl.question("\nEnter name for new keystore: ", resolve);
    });
    const keystoreName = answer.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(keystoreName)) {
      throw new Error("Keystore name must contain only letters, numbers, underscores or hyphens.");
    }
    if (keystoreName === "scaffold-eth-default") {
      throw new Error("The name scaffold-eth-default is reserved for local development.");
    }

    const keystorePath = join(homedir(), ".foundry", "keystores");
    if (existsSync(join(keystorePath, keystoreName))) {
      throw new Error("Keystore already exists. Please choose a different name.");
    }
    mkdirSync(keystorePath, { recursive: true });
    rl.close();

    // Foundry generates and encrypts the key directly; no private-key output parsing.
    // Inherited stdio lets the user enter the password in Foundry's hidden prompt.
    console.log("\n🔑 Generating encrypted keystore...");
    await new Promise((resolve, reject) => {
      const walletProcess = spawn(
        "cast",
        ["wallet", "new", keystorePath, keystoreName],
        { stdio: "inherit" }
      );
      walletProcess.on("error", reject);
      walletProcess.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("Keystore creation failed."));
      });
    });

    console.log("\n💰 Fund the address and re-run the deploy command to use this keystore.");
    console.log(`\nTIP: Use \`yarn account\` and select \`${keystoreName}\` to check its balance.`);
    return keystoreName;
  } finally {
    rl.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createKeystore().catch((error) => {
    console.error("\n❌ Error creating keystore:", error.message);
    process.exitCode = 1;
  });
}

export { createKeystore };
