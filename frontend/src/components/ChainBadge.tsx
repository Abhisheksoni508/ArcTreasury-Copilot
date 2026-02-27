const CHAIN_COLORS: Record<string, string> = {
  ethereum: 'bg-indigo-100 text-indigo-800',
  polygon: 'bg-purple-100 text-purple-800',
  arbitrum: 'bg-sky-100 text-sky-800',
  solana: 'bg-teal-100 text-teal-800',
  avalanche: 'bg-red-100 text-red-700',
  base: 'bg-blue-100 text-blue-800',
};

export default function ChainBadge({ chain }: { chain: string }) {
  const color = CHAIN_COLORS[chain.toLowerCase()] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {chain}
    </span>
  );
}
