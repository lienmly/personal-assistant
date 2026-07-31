import { CalendarDays } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";

export const metadata = { title: "Calendar · Clan Centurio" };

const VIEWS = ["Month", "Week", "Day"] as const;

export default function CalendarPage() {
  return (
    <>
      <SurfaceHeader
        title="Calendar"
        tagline="Events, mark due dates and drop publish times layered on one timeline."
      />

      <Card>
        <div className="mb-4 flex items-center gap-1 rounded-full bg-inset p-1 w-fit">
          {VIEWS.map((view, index) => (
            <span
              key={view}
              className={
                index === 0
                  ? "rounded-full bg-obsidian px-4 py-1.5 text-[13px] font-medium text-white"
                  : "px-4 py-1.5 text-[13px] text-muted"
              }
            >
              {view}
            </span>
          ))}
        </div>

        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          body="Month, week and day views arrive together, colour-coded by area — including the baby's feeds, naps and appointments."
          phase="Arrives in Phase 4"
          className="py-16"
        />
      </Card>
    </>
  );
}
