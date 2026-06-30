import { useId } from "react";
import { cn } from "@/lib/cn";

/** The forma mark: an arch of balanced stones held in equilibrium by its keystone. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const bg = `${id}-bg`;
  const stone = `${id}-stone`;
  const key = `${id}-key`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="forma"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2c1d13" />
          <stop offset="1" stopColor="#191009" />
        </linearGradient>
        <linearGradient id={stone} x1="14" y1="14" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#edd4b0" />
          <stop offset="1" stopColor="#cd9a67" />
        </linearGradient>
        <linearGradient id={key} x1="26" y1="13" x2="38" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbdfa6" />
          <stop offset="1" stopColor="#e6b066" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${bg})`} />
      <rect x="2.75" y="2.75" width="58.5" height="58.5" rx="11.5" fill="none" stroke="#d9a066" strokeOpacity="0.14" strokeWidth="1.5" />
      <path fill={`url(#${stone})`} d="M12 52 L12 34 A20 20 0 0 1 52 34 L52 52 L44 52 L44 34 A12 12 0 0 0 20 34 L20 52 Z" />
      <g stroke="#191009" strokeWidth="2.1" strokeLinecap="round">
        <line x1="41.71" y1="26.95" x2="48.18" y2="22.24" />
        <line x1="35.71" y1="22.59" x2="38.18" y2="14.98" />
        <line x1="28.29" y1="22.59" x2="25.82" y2="14.98" />
        <line x1="22.29" y1="26.95" x2="15.82" y2="22.24" />
        <line x1="44" y1="34" x2="52" y2="34" />
        <line x1="12" y1="34" x2="20" y2="34" />
        <line x1="12" y1="43" x2="20" y2="43" />
        <line x1="44" y1="43" x2="52" y2="43" />
      </g>
      <path fill={`url(#${key})`} d="M28.29 22.59 L25.82 14.98 L38.18 14.98 L35.71 22.59 Z" />
    </svg>
  );
}

/** Mark + wordmark lockup used in the app chrome. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="w-7 h-7 rounded-[6px]" />
      <span className="text-lg font-semibold tracking-tight text-neutral-100">forma</span>
    </span>
  );
}
