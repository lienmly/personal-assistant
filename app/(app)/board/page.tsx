import { Swords } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";

export const metadata = { title: "Hunt Board · Clan Centurio" };

export default function BoardPage() {
  return (
    <>
      <SurfaceHeader
        title="Hunt Board"
        tagline="Every open mark, grouped by project. This is where you plan — not where you execute."
        meta="0 open"
      />

      <Card>
        <EmptyState
          icon={Swords}
          title="No marks yet"
          body="Marks are tasks. Each one hangs off a project, or floats in an area for one-offs. Completing one bumps its project's momentum."
          phase="Arrives in Phase 2"
          className="py-16"
        />
      </Card>
    </>
  );
}
