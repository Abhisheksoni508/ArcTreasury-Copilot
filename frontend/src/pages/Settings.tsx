import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api';
import type { Settings as SettingsType } from '../types';

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [saving, setSaving] = useState(false);

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

  if (!settings) {
    return <div className="text-gray-400 py-10 text-center">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* Adapter Mode */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg">Adapter Mode</h3>
        <p className="text-sm text-gray-500">
          Controls whether payouts are executed through the mock adapter (simulated) or a real integration.
        </p>
        <div className="flex gap-3">
          {['mock', 'circle', 'arc'].map(mode => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              disabled={saving}
              className={`px-5 py-3 rounded-lg border-2 text-sm font-medium transition-colors
                ${settings.adapter_mode === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${mode === 'mock' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                <span className="uppercase font-bold">{mode}</span>
              </div>
              <div className="text-xs mt-1 text-gray-400">
                {mode === 'mock' ? 'Deterministic simulated outcomes' :
                 mode === 'circle' ? 'Circle Gateway API' :
                 'Arc Bridge Kit API'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Policy Config */}
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

      {/* Chain & Wallet Info */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h3 className="font-semibold text-lg">System Info</h3>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-gray-500">Supported Chains: </span>
            <span className="font-medium">{settings.supported_chains.join(', ')}</span>
          </div>
          <div>
            <span className="text-gray-500">Treasury Wallet: </span>
            <span className="font-mono text-xs">{settings.treasury_wallet}</span>
          </div>
        </div>
      </div>

      {/* Mode Legend */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h4 className="font-semibold text-amber-800 text-sm">About Real vs Simulated</h4>
        <ul className="mt-2 text-sm text-amber-700 space-y-1">
          <li><strong>SIMULATED</strong> — Payout is executed through the mock adapter with deterministic demo outcomes. No real funds are moved.</li>
          <li><strong>REAL</strong> — Payout is executed through Circle or Arc API with actual USDC transfers on-chain.</li>
        </ul>
      </div>
    </div>
  );
}
