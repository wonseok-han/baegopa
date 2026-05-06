export function RouletteIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="4" fill="currentColor" />
      <path d="M24 4 L24 20" stroke="currentColor" strokeWidth="2" />
      <path d="M24 28 L24 44" stroke="currentColor" strokeWidth="2" />
      <path d="M4 24 L20 24" stroke="currentColor" strokeWidth="2" />
      <path d="M28 24 L44 24" stroke="currentColor" strokeWidth="2" />
      <path d="M10 10 L19 19" stroke="currentColor" strokeWidth="2" />
      <path d="M29 29 L38 38" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function SlotIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="3" />
      <line x1="18" y1="8" x2="18" y2="40" stroke="currentColor" strokeWidth="2" />
      <line x1="30" y1="8" x2="30" y2="40" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="22" x2="44" y2="22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <line x1="4" y1="26" x2="44" y2="26" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="11" cy="24" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="37" cy="24" r="3" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function PinballIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="16" r="2.5" fill="currentColor" />
      <circle cx="32" cy="16" r="2.5" fill="currentColor" />
      <circle cx="24" cy="22" r="2.5" fill="currentColor" />
      <circle cx="16" cy="28" r="2.5" fill="currentColor" />
      <circle cx="32" cy="28" r="2.5" fill="currentColor" />
      <circle cx="24" cy="12" r="4" fill="currentColor" opacity="0.4" />
      <line x1="8" y1="36" x2="40" y2="36" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function DiceIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <rect x="6" y="6" width="36" height="36" rx="6" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
      <circle cx="32" cy="16" r="3" fill="currentColor" />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
      <circle cx="16" cy="32" r="3" fill="currentColor" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  );
}

export function GachaIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="20" r="14" stroke="currentColor" strokeWidth="3" />
      <path d="M14 32 L14 40 Q14 44 18 44 L30 44 Q34 44 34 40 L34 32" stroke="currentColor" strokeWidth="3" fill="none" />
      <circle cx="20" cy="16" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="28" cy="14" r="2.5" fill="currentColor" opacity="0.3" />
      <circle cx="22" cy="22" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="30" cy="20" r="2.5" fill="currentColor" opacity="0.3" />
      <rect x="18" y="32" width="12" height="4" rx="2" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  roulette: RouletteIcon,
  slot: SlotIcon,
  pinball: PinballIcon,
  gacha: GachaIcon,
  dice: DiceIcon,
};

export function GameIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = iconMap[name] || RouletteIcon;
  return <Icon className={className} />;
}
