import { PrismaClient } from "@prisma/client";
import { config } from "./env";

// ─── Prevent multiple Prisma instances in development ─────
// In dev, ts-node-dev restarts the server on every file change.
// Without this, every restart creates a NEW DB connection,
// eventually exhausting Supabase's connection limit.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      config.app.nodeEnv === "development"
        ? ["query", "warn", "error"]  // show all DB queries in dev
        : ["warn", "error"],           // only warnings/errors in prod
    datasources: {
      db: {
        url: config.db.url,
      },
    },
  });
};

// Use existing instance in dev, create fresh in prod
export const db = globalThis.__prisma ?? createPrismaClient();

if (config.app.nodeEnv !== "production") {
  globalThis.__prisma = db;
}

// ─── Graceful shutdown ────────────────────────────────────
// When server stops (Ctrl+C or crash), close DB connection cleanly
process.on("beforeExit", async () => {
  await db.$disconnect();
});