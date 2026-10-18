import { useId } from "react";

/**
 * EVNet Sentinel mark: a shield (protection) whose centre is a charging bolt
 * (EV charging). Drawn on a 32-unit grid so it stays crisp from favicon size
 * up; app/icon.svg is the same artwork for the browser tab.
 */
export default function Logo({ className = "h-7 w-7", title }: { className?: string; title?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`${id}-edge`} x1="5" y1="3" x2="27" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <path
        d="M16 2.75 27 6.6v8.3c0 6.9-4.6 12.1-11 14.35C9.6 27 5 21.8 5 14.9V6.6L16 2.75Z"
        fill="#22C55E" fillOpacity="0.12" stroke={`url(#${id}-edge)`} strokeWidth="2" strokeLinejoin="round"
      />
      <path d="M17.6 7.5 10.8 17.2h4.6l-1.5 7.3 7.3-10.2h-4.7l1.1-6.8Z" fill="#22C55E" />
    </svg>
  );
}
