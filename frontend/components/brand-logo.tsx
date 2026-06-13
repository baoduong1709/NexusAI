import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 36, className }: BrandLogoProps) {
  return (
    // Render the generated PNG logo instead of the old SVG logo
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="NexusAI Logo"
      className={cn("shrink-0 select-none rounded-xl", className)}
    />
  );
}

