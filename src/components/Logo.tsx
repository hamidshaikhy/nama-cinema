/**
 * The mark is the product in one shape: a viewer (the dot), their cone of
 * sight, and the curved screen it lands on.
 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 54 L7 22 Q32 9 57 22 Z" fill="currentColor" opacity="0.16" />
      <path
        d="M7 22 Q32 9 57 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="54" r="6" fill="var(--turq)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo__word">نما</span>
    </span>
  );
}
