import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { auth } from "@/lib/auth";

/**
 * Server-side gate for every authenticated surface. `proxy.ts` already turns
 * signed-out visitors away, but that check is optimistic — this one is the
 * real boundary, and it's what supplies the session to the shell.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <AppShell user={session.user} todayLabel={todayLabel}>
      {children}
    </AppShell>
  );
}
