import { useEffect, useState } from 'react';
import { getSettings, updateSettings, setupTreasuryWallet } from '../api';
import type { Settings as SettingsType, WalletSetupResponse } from '../types';

const ADAPTER_DETAILS: Record<string, { label: string; description: string; color: string; detail: string }> = {
  mock: {
    label: 'MOCK',
    description: 'Deterministic simulated outcomes',
    color: 'bg-yellow-400',
    detail: 'No real funds moved. Predictable demo scenarios: instant success, retry-then-success, failure, queued.',
  },
  circle: {
    label: 'CIRCLE',
    description: 'Circle Gateway + Circle Wallets API',
    color: 'bg-blue-500',
    detail: 'Real USDC payouts via Circle Programmable Wallets. Circle Gateway handles cross-chain routing via CCTP. Requires CIRCLE_API_KEY + CIRCLE_WALLET_ID.',
  },
  arc: {
    label: 'ARC',
    description: 'Arc Bridge Kit (Circle L1 + CCTP)',
    color: 'bg-green-500',
    detail: "USDC bridging to Arc (Circle's L1 blockchain) via Circle CCTP V2. Arc testnet: chainId=5042002, CCTP domain=26. Requires ARC_API_KEY (or CIRCLE_API_KEY).",
  },
};

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupResult, setSetupResult] = useState<WalletSetupResponse | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleModeChange = async (mode: string) => {
    setSaving(true);
    try {
      const s = await updateSettings({ adapter_mode: mode } as Partial<SettingsType>);
      setSettings(s);
    } catch {
      // ignore
    }
    setSaving(false);
  };

  const handleSetupWallet = async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      const result = await setupTreasuryWallet();
      setSetupResult(result);
      const updatedSettings = await getSettings();
      setSettings(updatedSettings);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Wallet setup failed');
    }
    setSetupLoading(false);
  };

  if (!settings) {
    return <div className="text-gray-400 py-10 text-center">Loading settings...</div>;
  }

  const activeDetail = ADAPTER_DETAILS[settings.adapter_mode] ?? ADAPTER_DETAILS.mock;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg">Adapter Mode</h3>
        <p className="text-sm text-gray-500">
          Controls whether payouts are executed through the mock adapter (simulated),
          Circle Gateway (real USDC via Circle Wallets), or Arc Bridge Kit (USDC to Arc L1 via CCTP).
        </p>
        <div className="flex gap-3">
          {Object.entries(ADAPTER_DETAILS).map(([mode, info]) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              disabled={saving}
              className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors text-left
                ${settings.adapter_mode === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${info.color}`} />
                <span className="uppercase font-bold">{info.label}</span>
              </div>
              <div className="text-xs mt-1 text-gray-400">{info.description}</div>
            </button>
          ))}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
          <span className="font-semibold">{activeDetail.label}: </span>
          {activeDetail.detail}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Treasury Wallet Setup</h3>
          <button
            onClick={handleSetupWallet}
            disabled={setupLoading}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {setupLoading ? 'Setting up...' : 'Setup Treasury Wallet'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Creates a Circle developer-controlled wallet and configures <code className="bg-gray-100 px-1 rounded">CIRCLE_WALLET_ID</code>
          in the running backend process so real payouts can execute immediately.
        </p>
        {setupError && (
          <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded p-3">{setupError}</div>
        )}
        {setupResult && (
          <div className="text-xs bg-green-50 border border-green-200 text-green-700 rounded p-3 space-y-1">
            <p><strong>Wallet ID:</strong> <code>{setupResult.wallet_id}</code></p>
            <p><strong>Address:</strong> <code>{setupResult.address}</code></p>
            <p><strong>Chain:</strong> {setupResult.blockchain}</p>
            <p>{setupResult.message}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Circle Gateway + Circle Wallets</h3>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            settings.circle_sandbox
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {settings.circle_sandbox ? 'SANDBOX' : 'PRODUCTION'}
          </span>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <strong>Circle Gateway</strong> provides cross-chain USDC settlement via CCTP (Cross-Chain Transfer Protocol).
            USDC is natively burned on the source chain and minted on the destination — no wrapping, no synthetics.
          </p>
          <p>
            <strong>Circle Wallets</strong> (Programmable Wallets) hold the treasury USDC and sign transfer transactions.
            Transfers use <code className="bg-gray-100 px-1 rounded">POST /v1/transfers</code> with your wallet ID as source.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ConfigRow
            label="API Endpoint"
            value={settings.circle_sandbox ? 'api-sandbox.circle.com/v1' : 'api.circle.com/v1'}
          />
          <ConfigRow
            label="Wallet Configured"
            value={settings.circle_wallet_configured ? 'Yes (CIRCLE_WALLET_ID set)' : 'No — set CIRCLE_WALLET_ID'}
            warn={!settings.circle_wallet_configured}
          />
          <ConfigRow label="API Key" value="Set via CIRCLE_API_KEY env var" />
          <ConfigRow label="Currency" value="USDC (represented as USD in API)" />
          <ConfigRow label="Chains" value="ETH, MATIC, ARB, SOL, AVAX, BASE, ARC" />
          <ConfigRow label="Idempotency" value="UUID per transfer (retry-safe)" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Arc Bridge Kit (Circle L1)</h3>
          <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-800">
            {settings.arc_chain}
          </span>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <strong>Arc</strong> is Circle's EVM-compatible Layer-1 blockchain for stablecoin finance.
            It uses USDC as the native gas token and achieves sub-second finality via Malachite BFT consensus.
          </p>
          <p>
            <strong>Bridge Kit</strong> abstracts CCTP V2 bridging to Arc. The pattern:
            Approve → Burn (source chain) → Attest (Circle Iris) → Mint (Arc).
            The backend routes Arc transfers via Circle's API with the Arc chain identifier.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ConfigRow label="Chain" value={`${settings.arc_chain} (chainId: 5042002)`} />
          <ConfigRow label="CCTP Domain" value="26 (Arc testnet)" />
          <ConfigRow label="USDC on Arc" value="0x3600...0000 (native)" />
          <ConfigRow label="Gas Token" value="USDC (no ETH needed)" />
          <ConfigRow label="API Key" value="Set via ARC_API_KEY (or CIRCLE_API_KEY)" />
          <ConfigRow label="Source Wallet" value="Set via ARC_SOURCE_WALLET env var" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg">Policy Configuration</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="text-gray-500 text-xs uppercase">Max Amount Limit</label>
            <div className="text-lg font-mono font-semibold">${settings.policy_max_amount.toLocaleString()}</div>
          </div>
          <div>
            <label className="text-gray-500 text-xs uppercase">Velocity Limit</label>
            <div className="text-lg font-mono font-semibold">{settings.policy_velocity_limit} per period</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg">System Info</h3>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-gray-500">Supported Chains: </span>
            <span className="font-medium">{settings.supported_chains.join(', ')}</span>
          </div>
          <div>
            <span className="text-gray-500">Treasury Wallet: </span>
            <span className="font-mono text-xs break-all">{settings.treasury_wallet}</span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h4 className="font-semibold text-amber-800 text-sm">About Real vs Simulated</h4>
        <ul className="mt-2 text-sm text-amber-700 space-y-1">
          <li><strong>SIMULATED</strong> — Mock adapter with deterministic demo outcomes. No real funds moved. Safe for demos.</li>
          <li><strong>REAL</strong> — Circle or Arc adapter executing actual USDC transfers on-chain via Circle's API.</li>
        </ul>
        <p className="mt-2 text-xs text-amber-600">
          Env vars for real mode: <code className="bg-amber-100 px-1 rounded">CIRCLE_API_KEY</code>,{' '}
          <code className="bg-amber-100 px-1 rounded">CIRCLE_WALLET_ID</code>,{' '}
          <code className="bg-amber-100 px-1 rounded">CIRCLE_SANDBOX=false</code> for production.
        </p>
      </div>
    </div>
  );
}

function ConfigRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xs font-mono mt-0.5 ${warn ? 'text-red-600' : 'text-gray-700'}`}>{value}</div>
    </div>
  );
}
