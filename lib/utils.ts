/** Tiny classname joiner. Swap for clsx + tailwind-merge if we ever need
 *  conflict resolution; today we don't. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
