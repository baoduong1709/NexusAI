import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 36, className }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 40 40'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={cn("shrink-0 select-none", className)}
      aria-hidden='true'
    >
      <defs>
        {/* Clean, high-contrast gradients */}
        <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0B0F19" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>

        <linearGradient id="cyan-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="100%" stopColor="#00A3FF" />
        </linearGradient>

        <radialGradient id="node-blue" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </radialGradient>

        <radialGradient id="node-cyan" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="100%" stopColor="#0891B2" />
        </radialGradient>
      </defs>

      {/* Background container */}
      <rect width='40' height='40' rx='12' fill='url(#bg-grad)' />
      <rect width='39' height='39' x='0.5' y='0.5' rx='11.5' stroke='#ffffff' strokeOpacity='0.1' fill='none' />

      {/* Connection lines (Very bold for readability at small sizes) */}
      {/* 1. Base White Path */}
      <path
        d='M12 27.5V12.5L28 27.5V12.5 M12 12.5L20 20L28 12.5'
        stroke='#FFFFFF'
        strokeWidth='3.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />

      {/* 2. Core Cyan V-Shape */}
      <path
        d='M12 12.5L20 20L28 12.5'
        stroke='url(#cyan-glow)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />

      {/* Nodes (Clean, high-contrast vector circles) */}
      {/* Top-Left: Blue */}
      <circle cx='12' cy='12.5' r='3.5' fill='url(#node-blue)' stroke='#FFFFFF' strokeWidth='1.2' />
      {/* Top-Right: Cyan */}
      <circle cx='28' cy='12.5' r='3.5' fill='url(#node-cyan)' stroke='#FFFFFF' strokeWidth='1.2' />
      {/* Bottom-Left: Cyan */}
      <circle cx='12' cy='27.5' r='3.5' fill='url(#node-cyan)' stroke='#FFFFFF' strokeWidth='1.2' />
      {/* Bottom-Right: Blue */}
      <circle cx='28' cy='27.5' r='3.5' fill='url(#node-blue)' stroke='#FFFFFF' strokeWidth='1.2' />
    </svg>
  );
}
