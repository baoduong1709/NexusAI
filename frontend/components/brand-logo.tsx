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
      className={cn("shrink-0", className)}
      aria-hidden='true'
    >
      <rect width='40' height='40' rx='11' fill='#111827' />
      <path
        d='M12 27.5V12.5L28 27.5V12.5'
        stroke='#F8FAFC'
        strokeWidth='4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <path
        d='M12 12.5L20 20L28 12.5'
        stroke='#38BDF8'
        strokeWidth='2.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <circle cx='12' cy='12.5' r='3.25' fill='#2563EB' stroke='#F8FAFC' strokeWidth='1.5' />
      <circle cx='28' cy='12.5' r='3.25' fill='#06B6D4' stroke='#F8FAFC' strokeWidth='1.5' />
      <circle cx='12' cy='27.5' r='3.25' fill='#06B6D4' stroke='#F8FAFC' strokeWidth='1.5' />
      <circle cx='28' cy='27.5' r='3.25' fill='#2563EB' stroke='#F8FAFC' strokeWidth='1.5' />
    </svg>
  );
}
