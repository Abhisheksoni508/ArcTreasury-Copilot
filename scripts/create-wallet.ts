/**
 * create-wallet.ts — Circle Dev-Controlled Wallet Setup
 *
 * Follows the official Circle quickstart:
 * https://developers.circle.com/w3s/developer-controlled-create-your-first-wallet
 *
 * What this script does:
 *   1. Reads CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET from backend/.env
 *   2. Registers the entity secret with Circle via raw API (POST /v1/w3s/config/entity)
 *   3. Creates a WalletSet named "ArcTreasury"
 *   4. Creates a wallet on ARC-TESTNET
 *   5. Writes CIRCLE_WALLET_ID and ARC_SOURCE_WALLET into backend/.env
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
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");
const ENV_PATH = path.join(__dirname, "../backend/.env");
const WALLET_SET_NAME = "ArcTreasury";
const BASE_URL = "https://api-sandbox.circle.com/v1/w3s";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Encrypt entity secret with Circle's RSA public key (OAEP / SHA-256) → base64 */
async function encryptEntitySecret(publicKeyPem: string, entitySecretHex: string): Promise<string> {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(entitySecretHex, "hex")
  );
  return encrypted.toString("base64");
}

/** Fetch Circle's RSA public key for this entity */
async function getPublicKey(apiKey: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/config/entity/publicKey`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to get public key: HTTP ${res.status}`);
  const data = await res.json() as any;
  return data.data.publicKey as string;
}

/** Register entity secret ciphertext with Circle (one-time, 409 = already registered = OK) */
async function registerEntitySecret(apiKey: string, ciphertext: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/config/entity`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), entitySecretCiphertext: ciphertext }),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Registration failed: HTTP ${res.status} — ${text.slice(0, 300)}`);
  }
  if (res.status === 409) {
    console.log("      (Already registered — continuing)");
  }
}

/** Upsert a key=value line in the .env file */
function upsertEnv(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) return content.replace(regex, `${key}=${value}`);
  return content.trimEnd() + `\n${key}=${value}\n`;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not set. Check backend/.env");

  let entitySecret = process.env.CIRCLE_ENTITY_SECRET ?? "";
  if (!entitySecret) {
    entitySecret = crypto.randomBytes(32).toString("hex");
    console.log("Generated new Entity Secret (will be saved to .env).");
  } else {
    console.log("Using existing CIRCLE_ENTITY_SECRET from .env");
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1 — fetch public key & encrypt entity secret
  console.log("\n[1/4] Fetching Circle public key and encrypting entity secret...");
  const publicKeyPem = await getPublicKey(apiKey);
  const ciphertext = await encryptEntitySecret(publicKeyPem, entitySecret);
  console.log(`      Ciphertext: ${ciphertext.length} chars (expected 684)`);

  // Step 2 — register entity secret
  console.log("\n[2/4] Registering entity secret with Circle...");
  await registerEntitySecret(apiKey, ciphertext);
  console.log("      Done.");

  // Update .env if we generated a new secret
  let envContent = fs.readFileSync(ENV_PATH, "utf-8");
  if (!process.env.CIRCLE_ENTITY_SECRET) {
    envContent = upsertEnv(envContent, "CIRCLE_ENTITY_SECRET", entitySecret);
    fs.writeFileSync(ENV_PATH, envContent, "utf-8");
    console.log("      CIRCLE_ENTITY_SECRET saved to backend/.env");
  }

  // Step 3 — create WalletSet + Wallet using the SDK client
  console.log(`\n[3/4] Creating WalletSet "${WALLET_SET_NAME}" and wallet on ARC-TESTNET...`);
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletSet = (await client.createWalletSet({ name: WALLET_SET_NAME })).data?.walletSet;
  if (!walletSet?.id) throw new Error("WalletSet creation failed: no ID returned");
  console.log(`      WalletSet ID : ${walletSet.id}`);

  const wallet = (
    await client.createWallets({
      walletSetId: walletSet.id,
      blockchains: ["ARC-TESTNET"],
      count: 1,
      accountType: "EOA",
    } as any)
  ).data?.wallets?.[0];
  if (!wallet) throw new Error("Wallet creation failed: no wallet returned");

  console.log(`      Wallet ID    : ${wallet.id}`);
  console.log(`      Address      : ${wallet.address}`);
  console.log(`      Blockchain   : ${wallet.blockchain}`);

  fs.writeFileSync(path.join(OUTPUT_DIR, "wallet-info.json"), JSON.stringify(wallet, null, 2));

  // Step 4 — update backend/.env
  console.log("\n[4/4] Updating backend/.env...");
  envContent = fs.readFileSync(ENV_PATH, "utf-8");
  envContent = upsertEnv(envContent, "CIRCLE_WALLET_ID", wallet.id);
  envContent = upsertEnv(envContent, "ARC_SOURCE_WALLET", wallet.address ?? "");
  fs.writeFileSync(ENV_PATH, envContent, "utf-8");
  console.log(`      CIRCLE_WALLET_ID  = ${wallet.id}`);
  console.log(`      ARC_SOURCE_WALLET = ${wallet.address}`);

  // Prompt to fund
  console.log("\n" + "=".repeat(60));
  console.log("  WALLET CREATED — Fund it before running payouts");
  console.log("=".repeat(60));
  console.log("\n  1. Go to https://faucet.circle.com");
  console.log('  2. Select "Arc Testnet" network');
  console.log(`  3. Paste address: ${wallet.address}`);
  console.log('  4. Click "Send USDC"\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) =>
    rl.question("Press Enter after faucet tokens are sent (Ctrl+C to skip)... ", () => {
      rl.close();
      resolve();
    })
  );

  // Verify balance
  console.log("\nChecking balance...");
  const balances = (await client.getWalletTokenBalance({ id: wallet.id } as any)).data?.tokenBalances;
  if (balances?.length) {
    for (const b of balances as any[]) console.log(`  ${b.token?.symbol ?? "?"}: ${b.amount}`);
  } else {
    console.log("  No balances yet — faucet may still be processing.");
  }

  console.log("\n  Setup complete! Restart the backend to load the new .env values.");
  console.log(`  Explorer: https://testnet.arcscan.app/address/${wallet.address}\n`);
}

main().catch((err) => {
  console.error("\nError:", err.message || err);
  process.exit(1);
});
