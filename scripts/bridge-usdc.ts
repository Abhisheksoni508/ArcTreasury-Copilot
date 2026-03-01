/**
 * Bridge Kit USDC Transfer — ArcTreasury Copilot
 *
 * Demonstrates Circle Bridge Kit SDK integration for crosschain USDC transfers.
 * Bridge Kit uses CCTP V2 under the hood to burn USDC on the source chain and
 * mint natively on the destination chain.
 *
 * Usage:
 *   npx tsx bridge-usdc.ts --from ethereum --to arbitrum --amount 100
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - Private key with USDC balance on source chain
 *   - RPC endpoints for both chains
 *
 * Docs: https://developers.circle.com/bridge-kit
 */

import { parseArgs } from 'node:util';

// ── CLI args ────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: 'ethereum' },
    to: { type: 'string', default: 'arbitrum' },
    amount: { type: 'string', default: '10' },
  },
});

const sourceChain = values.from!;
const destChain = values.to!;
const amount = values.amount!;

// ── Chain config ────────────────────────────────────────────────────────

interface ChainConfig {
  name: string;
  chainId: number;
  testnetChainId: number;
  rpcUrl: string;
  usdcAddress: string;
  cctpDomain: number;
  messageTransmitter: string;
  tokenMessenger: string;
}

const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    testnetChainId: 11155111,
    rpcUrl: process.env.ETH_RPC_URL || 'https://rpc.sepolia.org',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    cctpDomain: 0,
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    testnetChainId: 421614,
    rpcUrl: process.env.ARB_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    cctpDomain: 3,
    messageTransmitter: '0xaCF1ceeF35caAc005e559ECbB6A6A4c6B6C47c47',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    testnetChainId: 84532,
    rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    cctpDomain: 6,
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    testnetChainId: 80002,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    cctpDomain: 7,
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
  avalanche: {
    name: 'Avalanche',
    chainId: 43114,
    testnetChainId: 43113,
    rpcUrl: process.env.AVAX_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    usdcAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    cctpDomain: 1,
    messageTransmitter: '0xa9fB1b3009DCb79E2fe346c16a604B8Fa8aE0a79',
    tokenMessenger: '0xeb08f243E5d3FCFF26A9E38Ae5520A669f4019d0',
  },
  solana: {
    name: 'Solana',
    chainId: 0,
    testnetChainId: 0,
    rpcUrl: process.env.SOL_RPC_URL || 'https://api.devnet.solana.com',
    usdcAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    cctpDomain: 5,
    messageTransmitter: '',
    tokenMessenger: '',
  },
  arc: {
    name: 'ARC (Circle)',
    chainId: 0,
    testnetChainId: 0,
    rpcUrl: '',
    usdcAddress: '',
    cctpDomain: 9,
    messageTransmitter: '',
    tokenMessenger: '',
  },
};

// ── Bridge Kit Integration Pattern ──────────────────────────────────────
//
// The Bridge Kit SDK provides a high-level API for CCTP transfers:
//
//   import { BridgeKit } from '@circle-fin/bridge-kit';
//   import { createWalletClient, http } from 'viem';
//   import { sepolia } from 'viem/chains';
//
//   const kit = new BridgeKit({ environment: 'testnet' });
//
//   // Create wallet adapter (viem, ethers, or Solana)
//   const walletClient = createWalletClient({
//     chain: sepolia,
//     transport: http(),
//     account: privateKeyToAccount(PRIVATE_KEY),
//   });
//
//   const result = await kit.bridge({
//     from: { chain: 'Ethereum', adapter: walletClient },
//     to:   { chain: 'Arbitrum',  adapter: arbClient },
//     amount: '100.00', // USDC
//   });
//
//   console.log('Bridge TX:', result.sourceTxHash);
//   console.log('Status:',   result.status);
//
// Under the hood, Bridge Kit:
//   1. Approves USDC spend on source chain → TokenMessenger
//   2. Calls depositForBurn() on TokenMessenger (burns USDC)
//   3. Waits for Circle attestation service
//   4. Calls receiveMessage() on destination MessageTransmitter (mints USDC)
//
// For this demo, we simulate the flow without requiring real private keys.

// ── Simulation ──────────────────────────────────────────────────────────

async function simulateBridge() {
  const src = CHAINS[sourceChain];
  const dst = CHAINS[destChain];

  if (!src || !dst) {
    console.error(`Unknown chain. Supported: ${Object.keys(CHAINS).join(', ')}`);
    process.exit(1);
  }

  if (sourceChain === destChain) {
    console.error('Source and destination must be different chains.');
    process.exit(1);
  }

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          Circle Bridge Kit — USDC Transfer               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`  Source:      ${src.name} (CCTP Domain ${src.cctpDomain})`);
  console.log(`  Destination: ${dst.name} (CCTP Domain ${dst.cctpDomain})`);
  console.log(`  Amount:      ${amount} USDC`);
  console.log(`  Protocol:    CCTP V2 (burn-attest-mint)\n`);

  // Step 1: Approve
  console.log('  [1/4] Approving USDC spend → TokenMessenger...');
  console.log(`        USDC: ${src.usdcAddress}`);
  console.log(`        TokenMessenger: ${src.tokenMessenger}`);
  await sleep(800);
  console.log('        ✓ Approved\n');

  // Step 2: Burn
  console.log('  [2/4] Burning USDC on source chain...');
  console.log(`        depositForBurn(${amount}, ${dst.cctpDomain}, recipient, ${src.usdcAddress})`);
  await sleep(1200);
  const fakeBurnTx = `0x${randomHex(64)}`;
  console.log(`        ✓ Burn TX: ${fakeBurnTx}\n`);

  // Step 3: Attest
  console.log('  [3/4] Waiting for Circle attestation...');
  console.log('        Attestation API: https://iris-api-sandbox.circle.com/attestations');
  await sleep(2000);
  const fakeAttestation = `0x${randomHex(128)}`;
  console.log(`        ✓ Attestation received (${fakeAttestation.slice(0, 20)}...)\n`);

  // Step 4: Mint
  console.log('  [4/4] Minting USDC on destination chain...');
  console.log(`        receiveMessage(message, attestation)`);
  console.log(`        MessageTransmitter: ${dst.messageTransmitter}`);
  await sleep(1000);
  const fakeMintTx = `0x${randomHex(64)}`;
  console.log(`        ✓ Mint TX: ${fakeMintTx}\n`);

  console.log('  ═══════════════════════════════════════════════════');
  console.log(`  ✅ Bridge complete: ${amount} USDC`);
  console.log(`     ${src.name} → ${dst.name}`);
  console.log(`     Total time: ~4s (simulated, real: ~60-120s)`);
  console.log('  ═══════════════════════════════════════════════════\n');
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function randomHex(len: number) { return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }

simulateBridge().catch(console.error);
