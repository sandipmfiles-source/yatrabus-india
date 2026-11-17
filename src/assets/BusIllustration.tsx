import React from 'react';

interface BusIllustrationProps {
  className?: string;
  routeNumber?: string;
  destinationText?: string;
  variant?: 'card' | 'banner' | 'compact' | 'icon';
}

/**
 * Custom SVG Bus Illustration for YatriBus
 * Replaces missing photographs with a crafted vector illustration
 * of a modern Indian electric/CNG transit bus in brand emerald/deep green livery.
 */
export const BusIllustration: React.FC<BusIllustrationProps> = ({
  className = "w-full h-40",
  routeNumber = "IN-BUS",
  destinationText = "YATRI EXPRESS",
  variant = 'card',
}) => {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Bus Icon"
      >
        <rect x="8" y="6" width="32" height="34" rx="6" fill="#0E4D34" />
        <rect x="12" y="10" width="24" height="12" rx="3" fill="#D1FAE5" />
        <rect x="12" y="26" width="6" height="4" rx="1" fill="#FEF08A" />
        <rect x="30" y="26" width="6" height="4" rx="1" fill="#FEF08A" />
        <rect x="19" y="27" width="10" height="2" rx="1" fill="#9CA3AF" />
        <circle cx="14" cy="40" r="3" fill="#1F2937" />
        <circle cx="34" cy="40" r="3" fill="#1F2937" />
        <rect x="16" y="7" width="16" height="2" rx="1" fill="#F59E0B" />
      </svg>
    );
  }

  return (
    <div className={`relative flex items-center justify-center bg-gradient-to-b from-yatribrand-50 to-yatriwarm-100 rounded-xl overflow-hidden border border-yatriwarm-200 select-none ${className}`}>
      <svg
        viewBox="0 0 400 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full max-h-52 object-contain p-2"
        role="img"
        aria-label={`Bus ${routeNumber} to ${destinationText}`}
      >
        <defs>
          <linearGradient id="busBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#15803D" />
            <stop offset="60%" stopColor="#0E4D34" />
            <stop offset="100%" stopColor="#072E20" />
          </linearGradient>
          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#BAE6FD" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="roofGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#072E20" />
            <stop offset="50%" stopColor="#166534" />
            <stop offset="100%" stopColor="#072E20" />
          </linearGradient>
          <filter id="shadowDrop" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#0E4D34" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Road Base / Ground Shadow */}
        <ellipse cx="200" cy="195" rx="160" ry="12" fill="#000000" fillOpacity="0.12" />
        <rect x="40" y="193" width="320" height="2" rx="1" fill="#94A3B8" fillOpacity="0.4" />
        <rect x="80" y="196" width="30" height="3" rx="1.5" fill="#E2E8F0" />
        <rect x="150" y="196" width="30" height="3" rx="1.5" fill="#E2E8F0" />
        <rect x="220" y="196" width="30" height="3" rx="1.5" fill="#E2E8F0" />
        <rect x="290" y="196" width="30" height="3" rx="1.5" fill="#E2E8F0" />

        {/* Bus Main Chassis & Shell */}
        <g filter="url(#shadowDrop)">
          {/* Main Body */}
          <path
            d="M 55 60 C 55 45, 70 40, 95 40 L 320 40 C 345 40, 360 48, 360 70 L 360 160 C 360 168, 355 172, 345 172 L 55 172 Z"
            fill="url(#busBodyGrad)"
          />

          {/* Roof AC / Battery Unit (Modern Indian EV bus styling) */}
          <rect x="120" y="28" width="160" height="12" rx="4" fill="url(#roofGrad)" />
          <rect x="135" y="32" width="25" height="4" rx="2" fill="#22C55E" fillOpacity="0.8" />
          <rect x="170" y="32" width="25" height="4" rx="2" fill="#22C55E" fillOpacity="0.8" />
          <rect x="205" y="32" width="25" height="4" rx="2" fill="#22C55E" fillOpacity="0.8" />
          <rect x="240" y="32" width="25" height="4" rx="2" fill="#22C55E" fillOpacity="0.8" />

          {/* Digital LED Route Display Screen */}
          <rect x="100" y="47" width="200" height="18" rx="3" fill="#111827" stroke="#374151" strokeWidth="1" />
          <text
            x="200"
            y="60"
            textAnchor="middle"
            fill="#FBBF24"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="1"
          >
            {routeNumber.toUpperCase()} • {destinationText.toUpperCase()}
          </text>

          {/* Windshield & Windows */}
          {/* Front Windshield */}
          <path
            d="M 60 72 L 95 72 L 95 120 L 60 120 Z"
            fill="url(#glassGrad)"
            stroke="#1E293B"
            strokeWidth="1.5"
          />
          {/* Side Windows with dividers */}
          <rect x="102" y="72" width="45" height="48" rx="2" fill="url(#glassGrad)" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="152" y="72" width="45" height="48" rx="2" fill="url(#glassGrad)" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="202" y="72" width="45" height="48" rx="2" fill="url(#glassGrad)" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="252" y="72" width="45" height="48" rx="2" fill="url(#glassGrad)" stroke="#1E293B" strokeWidth="1.5" />
          {/* Rear Window */}
          <path
            d="M 302 72 L 350 72 C 352 72, 354 75, 354 80 L 354 120 L 302 120 Z"
            fill="url(#glassGrad)"
            stroke="#1E293B"
            strokeWidth="1.5"
          />

          {/* Passenger Silhouettes inside windows */}
          <circle cx="75" cy="92" r="5" fill="#047857" fillOpacity="0.4" />
          <path d="M 68 112 C 68 102, 82 102, 82 112 Z" fill="#047857" fillOpacity="0.4" />

          <circle cx="125" cy="94" r="5" fill="#047857" fillOpacity="0.4" />
          <path d="M 118 112 C 118 104, 132 104, 132 112 Z" fill="#047857" fillOpacity="0.4" />

          <circle cx="225" cy="94" r="5" fill="#047857" fillOpacity="0.4" />
          <path d="M 218 112 C 218 104, 232 104, 232 112 Z" fill="#047857" fillOpacity="0.4" />

          {/* Passenger Door Cutout */}
          <rect x="306" y="80" width="38" height="88" rx="3" fill="none" stroke="#042F1D" strokeWidth="2" strokeDasharray="3 2" />
          <rect x="340" y="125" width="2" height="12" rx="1" fill="#D1D5DB" />

          {/* Exterior Livery Decal Stripe (Gold / Saffron Accent) */}
          <path d="M 55 132 L 358 132 L 358 136 L 55 136 Z" fill="#F59E0B" />
          <path d="M 55 138 L 358 138 L 358 141 L 55 141 Z" fill="#FFFFFF" fillOpacity="0.8" />

          {/* Brand Badge */}
          <text
            x="110"
            y="155"
            fill="#FFFFFF"
            fontSize="11"
            fontWeight="bold"
            fontFamily="sans-serif"
            letterSpacing="1"
          >
            YatriBus
          </text>
          <text
            x="165"
            y="155"
            fill="#86EFAC"
            fontSize="8"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            • COMMUNITY TRANSIT
          </text>

          {/* Headlights & Tail Lights */}
          {/* Front Light */}
          <circle cx="58" cy="150" r="5" fill="#FEF08A" />
          <path d="M 45 145 L 56 148 L 56 152 L 45 155 Z" fill="#FEF08A" fillOpacity="0.3" />
          {/* Amber Indicator */}
          <rect x="56" y="157" width="5" height="3" rx="1" fill="#F59E0B" />

          {/* Rear Tail Light */}
          <rect x="356" y="146" width="3" height="10" rx="1" fill="#EF4444" />
        </g>

        {/* Wheel Arches & Wheels */}
        {/* Front Wheel */}
        <g>
          <path d="M 85 172 A 22 22 0 0 1 133 172 Z" fill="#111827" />
          <circle cx="109" cy="172" r="18" fill="#1F2937" stroke="#111827" strokeWidth="4" />
          <circle cx="109" cy="172" r="10" fill="#9CA3AF" />
          <circle cx="109" cy="172" r="4" fill="#374151" />
          <circle cx="109" cy="165" r="1.5" fill="#FFFFFF" />
          <circle cx="116" cy="172" r="1.5" fill="#FFFFFF" />
          <circle cx="109" cy="179" r="1.5" fill="#FFFFFF" />
          <circle cx="102" cy="172" r="1.5" fill="#FFFFFF" />
        </g>

        {/* Rear Wheel (Double Axle Transit Look) */}
        <g>
          <path d="M 275 172 A 22 22 0 0 1 323 172 Z" fill="#111827" />
          <circle cx="299" cy="172" r="18" fill="#1F2937" stroke="#111827" strokeWidth="4" />
          <circle cx="299" cy="172" r="10" fill="#9CA3AF" />
          <circle cx="299" cy="172" r="4" fill="#374151" />
          <circle cx="299" cy="165" r="1.5" fill="#FFFFFF" />
          <circle cx="306" cy="172" r="1.5" fill="#FFFFFF" />
          <circle cx="299" cy="179" r="1.5" fill="#FFFFFF" />
          <circle cx="292" cy="172" r="1.5" fill="#FFFFFF" />
        </g>
      </svg>
      <div className="absolute bottom-2 right-3 text-[10px] font-medium text-yatribrand-800 bg-white/80 px-2 py-0.5 rounded-full backdrop-blur-sm border border-yatribrand-100">
        Verified SVG Asset
      </div>
    </div>
  );
};

export default BusIllustration;
