import type { ProjectPriority, ProjectStatus } from "@prisma/client";

/** Plain view types, for the same reason as `components/board/types.ts`:
 *  re-exporting the query's inferred type would drag `lib/db` into a client
 *  bundle. */

export type AreaOption = { id: string; name: string; color: string };

export type ProjectRowView = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The one thing this project is aiming at right now. Distinct from
   *  `description`: what it is, versus what it is *for* this month. */
  focus: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  cadenceDays: number | null;
  areaId: string;
  areaName: string;
  areaColor: string;
  /** Whole days since `lastTouchedAt`, computed server-side so the roster and
   *  Today can't disagree about what "3d" means. */
  idle: number;
  /** Preformatted server-side — a client `Intl` call would format in the
   *  browser's zone and disagree with the server's first paint. */
  touchedLabel: string;
  drifting: boolean;
  openTasks: number;
  items: number;
};
