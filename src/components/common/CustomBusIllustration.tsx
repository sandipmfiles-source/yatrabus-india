import React from 'react';

interface CustomBusIllustrationProps {
  className?: string;
  variant?: 'express' | 'city' | 'intercity' | 'sleeper';
  operatorName?: string;
  routeCode?: string;
}

export const CustomBusIllustration: React.FC<CustomBusIllustrationProps> = ({
  className = "w-full h-44",
  variant = 'express',
  operatorName = 'Bharat Express',
  routeCode = 'IND-BUS'
}) => {
  // Theme color accents based on variant
  const theme = {
    express: { primary: '#0e5a36', accent: '#f59e0b', roof: '#093c24', highlight: '#22c55e' },
    city: { primary: '#15803d', accent: '#3b82f6', roof: '#14532d', highlight: '#86efac' },
    intercity: { primary: '#1e3a8a', accent: '#f59e0b', roof: '#172554', highlight: '#60a5fa' },
    sleeper: { primary: '#4c1d95', accent: '#fbbf24', roof: '#2e1065', highlight: '#c084fc' },
  }[variant];

  return (
    <div className={`relative flex items-center justify-center p-2 rounded-xl bg-gradient-to-b from-surface-warm to-surface-subtle border border-surface-border overflow-hidden select-none ${className}`}>
      {/* Road / ground line subtle backdrop */}
      <div className="absolute bottom-4 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent opacity-80" />
      <div className="absolute bottom-2 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-slate-400 to-transparent opacity-40" />

      <svg
        viewBox="0 0 340 140"
        className="w-full h-full max-h-48 drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`bodyGrad-${variant}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={theme.highlight} stopOpacity="0.2" />
            <stop offset="25%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f8fafc" />
            <stop offset="90%" stopColor={theme.primary} />
          </linearGradient>

          <linearGradient id={`windowGlass`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.95" />
          </linearGradient>

          <filter id="busShadow" x="-5%" y="-5%" width="110%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.2" />
          </filter>
        </defs>

        {/* Shadow beneath bus */}
        <ellipse cx="170" cy="124" rx="140" ry="7" fill="#0f172a" opacity="0.18" />

        {/* Bus Main Chassis Group */}
        <g filter="url(#busShadow)">
          {/* Main Body */}
          <path
            d="M 28 36 C 28 26, 44 24, 75 24 L 290 24 C 304 24, 318 32, 318 48 L 318 102 C 318 108, 314 112, 308 112 L 34 112 C 28 112, 26 106, 26 100 L 26 48 C 26 40, 27 38, 28 36 Z"
            fill={`url(#bodyGrad-${variant})`}
            stroke={theme.roof}
            strokeWidth="1.5"
          />

          {/* Roof AC / Carrier Unit */}
          <rect x="90" y="16" width="130" height="9" rx="4" fill={theme.roof} />
          <line x1="110" y1="20" x2="190" y2="20" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />

          {/* Aerodynamic Front Cap Curve */}
          <path
            d="M 288 24 C 305 24, 318 34, 318 52 L 318 90 L 290 90 L 288 24 Z"
            fill={theme.primary}
            opacity="0.15"
          />

          {/* Decorative Brand Stripe across bottom */}
          <path
            d="M 26 84 L 318 84 L 318 96 L 26 96 Z"
            fill={theme.primary}
          />
          <path
            d="M 26 96 L 318 96 L 318 99 L 26 99 Z"
            fill={theme.accent}
          />

          {/* Destination Display Board (LED style) */}
          <rect x="235" y="28" width="70" height="13" rx="2.5" fill="#020617" stroke="#334155" strokeWidth="1" />
          <text
            x="270"
            y="37.5"
            fill={theme.accent}
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
            letterSpacing="0.5"
          >
            {routeCode}
          </text>

          {/* Side Windows Continuous Glass Strip */}
          <rect x="36" y="44" width="270" height="34" rx="4" fill="url(#windowGlass)" stroke="#0f172a" strokeWidth="1" />

          {/* Passenger Window Pillars */}
          <line x1="72" y1="44" x2="72" y2="78" stroke="#334155" strokeWidth="2.5" />
          <line x1="110" y1="44" x2="110" y2="78" stroke="#334155" strokeWidth="2.5" />
          <line x1="148" y1="44" x2="148" y2="78" stroke="#334155" strokeWidth="2.5" />
          <line x1="186" y1="44" x2="186" y2="78" stroke="#334155" strokeWidth="2.5" />
          <line x1="224" y1="44" x2="224" y2="78" stroke="#334155" strokeWidth="2.5" />
          <line x1="262" y1="44" x2="262" y2="78" stroke="#334155" strokeWidth="2.5" />

          {/* Glass glare highlight */}
          <path
            d="M 38 46 L 90 46 L 70 76 L 38 76 Z"
            fill="#ffffff"
            opacity="0.12"
          />
          <path
            d="M 120 46 L 160 46 L 140 76 L 100 76 Z"
            fill="#ffffff"
            opacity="0.08"
          />

          {/* Driver Cockpit Front Glass & Wiper */}
          <path
            d="M 285 45 L 305 45 C 311 45, 314 49, 314 55 L 314 77 L 285 77 Z"
            fill="#090d16"
          />
          <line x1="298" y1="74" x2="310" y2="52" stroke="#64748b" strokeWidth="1.5" />

          {/* Passenger Entry Doors */}
          <rect x="238" y="44" width="22" height="66" fill="#1e293b" opacity="0.15" />
          <line x1="249" y1="44" x2="249" y2="110" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 2" />
          <circle cx="246" cy="85" r="1.5" fill="#475569" />

          {/* Operator Name Label on Bus Side */}
          <text
            x="135"
            y="92"
            fill="#ffffff"
            fontSize="8"
            fontFamily="sans-serif"
            fontWeight="bold"
            letterSpacing="0.8"
            textAnchor="middle"
          >
            {operatorName.toUpperCase()}
          </text>

          {/* Headlight cluster */}
          <rect x="312" y="90" width="4" height="12" rx="2" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          <circle cx="314" cy="94" r="1.5" fill="#ffffff" />
          <circle cx="314" cy="98" r="1.5" fill="#f59e0b" />

          {/* Taillights */}
          <rect x="24" y="88" width="3" height="14" rx="1.5" fill="#dc2626" />

          {/* Front Bumper & Indicator */}
          <path d="M 312 104 C 316 104, 318 107, 318 111 L 304 111 Z" fill="#334155" />
          <circle cx="308" cy="107" r="1.5" fill="#f59e0b" />
        </g>

        {/* Wheel Arches & Wheels */}
        {/* Rear Wheel Arch */}
        <path d="M 52 112 C 52 98, 86 98, 86 112 Z" fill="#1e293b" />
        {/* Rear Wheel */}
        <g>
          <circle cx="69" cy="112" r="15" fill="#0f172a" />
          <circle cx="69" cy="112" r="10" fill="#334155" />
          <circle cx="69" cy="112" r="4.5" fill="#e2e8f0" />
          <circle cx="69" cy="112" r="2" fill="#0f172a" />
          {/* Wheel Lug Nuts */}
          <circle cx="69" cy="106" r="0.8" fill="#94a3b8" />
          <circle cx="75" cy="112" r="0.8" fill="#94a3b8" />
          <circle cx="69" cy="118" r="0.8" fill="#94a3b8" />
          <circle cx="63" cy="112" r="0.8" fill="#94a3b8" />
        </g>

        {/* Front Wheel Arch */}
        <path d="M 252 112 C 252 98, 286 98, 286 112 Z" fill="#1e293b" />
        {/* Front Wheel */}
        <g>
          <circle cx="269" cy="112" r="15" fill="#0f172a" />
          <circle cx="269" cy="112" r="10" fill="#334155" />
          <circle cx="269" cy="112" r="4.5" fill="#e2e8f0" />
          <circle cx="269" cy="112" r="2" fill="#0f172a" />
          {/* Wheel Lug Nuts */}
          <circle cx="269" cy="106" r="0.8" fill="#94a3b8" />
          <circle cx="275" cy="112" r="0.8" fill="#94a3b8" />
          <circle cx="269" cy="118" r="0.8" fill="#94a3b8" />
          <circle cx="263" cy="112" r="0.8" fill="#94a3b8" />
        </g>
      </svg>
    </div>
  );
};
