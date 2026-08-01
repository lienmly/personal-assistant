/** Plain view type, so the client components below never pull `lib/db` into
 *  the bundle. Same rule as studio/, board/ and today/. */
export type SprintView = {
  id: string;
  name: string;
  goal: string | null;
  /** "YYYY-MM-DD", so `<input type="date">` round-trips without a timezone. */
  startsOn: string;
  endsOn: string;
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
  done: number;
  total: number;
};
