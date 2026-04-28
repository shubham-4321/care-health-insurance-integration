import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { db } from "./config/db";

const startServer = async (): Promise<void> => {
  try {
    // ── Test DB connection ─────────────────────────────────
    await db.$connect();
    logger.info("[SERVER] Database connected successfully");

    // ── Start server ───────────────────────────────────────
    app.listen(config.app.port, () => {
      logger.info(
        `[SERVER] Running on port ${config.app.port} in ${config.app.nodeEnv} mode`
      );
    });
  } catch (err) {
    logger.error("[SERVER] Failed to start", { err });
    process.exit(1);
  }
};

// ─── Graceful shutdown ─────────────────────────────────────
process.on("SIGTERM", async () => {
  try {
    logger.info("[SERVER] SIGTERM received — shutting down gracefully");
    await db.$disconnect();
    process.exit(0);
  } catch (err) {
    logger.error("[SERVER] Error during shutdown", { err });
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  logger.error("[SERVER] Uncaught exception", { err });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[SERVER] Unhandled rejection", { reason });
  process.exit(1);
});

startServer();