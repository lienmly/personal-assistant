import { PrismaClient } from "@prisma/client";

/**
 * Next's dev server re-evaluates modules on every hot reload, which would open
 * a new connection pool each time and exhaust Postgres in a few edits. Stash
 * the client on globalThis so reloads reuse it. Production gets a fresh one.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
