/**
 * create-wallet.ts — Circle Dev-Controlled Wallet Setup
 *
 * Follows the official Circle quickstart:
 * https://developers.circle.com/w3s/developer-controlled-create-your-first-wallet
 *
 * What this script does:
 *   1. Reads CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET from backend/.env
 *      (generates a new entity secret if CIRCLE_ENTITY_SECRET is not set)
 *   2. Registers the entity secret with Circle (saves recovery file to output/)
 *   3. Creates a WalletSet named "ArcTreasury"
 *   4. Creates a wallet on ARC-TESTNET
 *   5. Appends CIRCLE_WALLET_ID, CIRCLE_WALLET_ADDRESS to backend/.env
 *   6. Prompts you to fund the wallet at https://faucet.circle.com
 *
 * Usage:
 *   cd scripts
 *   npm install
 *   node --env-file=../backend/.env --import=tsx create-wallet.ts
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const ENV_PATH = path.join(__dirname, "../backend/.env");
const WALLET_SET_NAME = "ArcTreasury";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY is not set. Check backend/.env");
  }

  // Use existing entity secret or generate a new one
  let entitySecret = process.env.CIRCLE_ENTITY_SECRET ?? "";
  const isNewSecret = !entitySecret;
  if (isNewSecret) {
    entitySecret = crypto.randomBytes(32).toString("hex");
    console.log("Generated new Entity Secret.");
  } else {
    console.log("Using existing CIRCLE_ENTITY_SECRET from .env");
  }

  // Step 1 — Register Entity Secret
  console.log("\n[1/4] Registering Entity Secret with Circle...");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: OUTPUT_DIR,
  });
  console.log("      Done. Recovery file saved to scripts/output/");

  if (isNewSecret) {
    fs.appendFileSync(ENV_PATH, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`, "utf-8");
    console.log("      CIRCLE_ENTITY_SECRET appended to backend/.env");
  }

  // Step 2 — Create WalletSet
  console.log(`\n[2/4] Creating WalletSet "${WALLET_SET_NAME}"...`);
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  const walletSet = (await client.createWalletSet({ name: WALLET_SET_NAME })).data?.walletSet;
  if (!walletSet?.id) throw new Error("WalletSet creation failed: no ID returned");
  console.log(`      WalletSet ID: ${walletSet.id}`);

  // Step 3 — Create Wallet on ARC-TESTNET
  console.log("\n[3/4] Creating wallet on ARC-TESTNET...");
  const wallet = (
    await client.createWallets({
      walletSetId: walletSet.id,
      blockchains: ["ARC-TESTNET"],
      count: 1,
      accountType: "EOA",
    })
  ).data?.wallets?.[0];
  if (!wallet) throw new Error("Wallet creation failed: no wallet returned");

  console.log(`      Wallet ID  : ${wallet.id}`);
  console.log(`      Address    : ${wallet.address}`);
  console.log(`      Blockchain : ${wallet.blockchain}`);

  // Save wallet-info.json
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "wallet-info.json"),
    JSON.stringify(wallet, null, 2),
    "utf-8"
  );

  // Step 4 — Update backend/.env
  console.log("\n[4/4] Updating backend/.env...");
  let envContent = fs.readFileSync(ENV_PATH, "utf-8");

  const upsert = (content: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    }
    return content.trimEnd() + `\n${key}=${value}\n`;
  };

  envContent = upsert(envContent, "CIRCLE_WALLET_ID", wallet.id);
  envContent = upsert(envContent, "ARC_SOURCE_WALLET", wallet.address ?? "");
  fs.writeFileSync(ENV_PATH, envContent, "utf-8");

  console.log(`      CIRCLE_WALLET_ID=${wallet.id}`);
  console.log(`      ARC_SOURCE_WALLET=${wallet.address}`);

  // Prompt to fund wallet
  console.log("\n" + "=".repeat(60));
  console.log("  WALLET CREATED — Fund it before running payouts");
  console.log("=".repeat(60));
  console.log("\n  1. Go to https://faucet.circle.com");
  console.log('  2. Select "Arc Testnet" network');
  console.log(`  3. Paste your wallet address: ${wallet.address}`);
  console.log('  4. Click "Send USDC"\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) =>
    rl.question("Press Enter once faucet tokens have been sent (or Ctrl+C to skip)... ", () => {
      rl.close();
      resolve();
    })
  );

  // Verify balance
  console.log("\nFetching wallet balance...");
  const balances = (await client.getWalletTokenBalance({ id: wallet.id })).data?.tokenBalances;
  if (balances?.length) {
    for (const b of balances) {
      console.log(`  ${b.token?.symbol ?? "Unknown"}: ${b.amount}`);
    }
  } else {
    console.log("  No token balances yet — faucet may still be processing.");
  }

  console.log("\n  Setup complete! Restart the backend to pick up the new .env values.");
  console.log(`  Explorer: https://testnet.arcscan.app/address/${wallet.address}\n`);
}

main().catch((err) => {
  console.error("\nError:", err.message || err);
  process.exit(1);
});
