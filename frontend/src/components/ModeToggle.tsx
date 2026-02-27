import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api';

export default function ModeToggle() {
  const [mode, setMode] = useState('mock');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSettings().then(s => setMode(s.adapter_mode)).catch(() => {});
  }, []);

  const toggle = async () => {
    setLoading(true);
    const next = mode === 'mock' ? 'circle' : mode === 'circle' ? 'arc' : 'mock';
    try {
      const s = await updateSettings({ adapter_mode: next });
      setMode(s.adapter_mode);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium
                 hover:bg-gray-50 transition-colors disabled:opacity-50"
      title="Click to cycle: mock → circle → arc"
    >
      <span className={`w-2 h-2 rounded-full ${mode === 'mock' ? 'bg-yellow-400' : 'bg-green-400'}`} />
      {mode.toUpperCase()}
      {mode === 'mock' && <span className="text-xs text-gray-400">SIMULATED</span>}
    </button>
  );
}
