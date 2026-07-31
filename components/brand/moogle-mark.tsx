/**
 * Clan Centurio's mark: a moogle silhouette — pom-pom on its antenna above a
 * rounded body. The pom carries the crimson accent; everything else is the
 * inherited text colour, so it works on black, white and crimson alike.
 */
export function MoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="5" r="3" fill="var(--color-accent)" />
      <path
        d="M12 8v3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 11.2c3.6 0 6.4 2.9 6.4 6.5 0 .7-.6 1.3-1.3 1.3H6.9c-.7 0-1.3-.6-1.3-1.3 0-3.6 2.8-6.5 6.4-6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
