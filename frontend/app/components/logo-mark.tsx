import clsx from "clsx";

export function LogoMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="bp-pilot logo"
      className={clsx("shrink-0", className)}
    >
      <defs>
        <linearGradient id="bpLogoBg" x1="5" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D946EF" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="14" fill="url(#bpLogoBg)" />
      <rect x="1" y="1" width="38" height="38" rx="14" stroke="rgba(255,255,255,0.26)" />
      <text x="13" y="27" fill="white" fontSize="18" fontWeight="700" fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">
        B
      </text>
      <path d="M29 9.4L29.9 11.7L32.3 11.8L30.4 13.3L31.1 15.6L29 14.2L26.9 15.6L27.6 13.3L25.7 11.8L28.1 11.7L29 9.4Z" fill="white" />
    </svg>
  );
}
