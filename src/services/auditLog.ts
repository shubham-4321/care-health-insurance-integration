import { db } from "../config/db";
import { logger } from "../config/logger";

// ─── Care API call audit log ──────────────────────────────
// One row per outbound Care call (success or failure). Fire-and-forget:
// failures here never break the outer flow.
type LogInput = {
  label: string;
  url: string;
  request?: unknown;
  response?: unknown;
  errorMessage?: string;
  httpStatus?: number;
  durationMs?: number;
  userId?: string;
  proposalNum?: string;
};

export const logCareCall = async (input: LogInput): Promise<void> => {
  try {
    await db.careApiLog.create({
      data: {
        label: input.label,
        url: input.url,
        request: (input.request as object) ?? undefined,
        response: (input.response as object) ?? undefined,
        errorMessage: input.errorMessage,
        httpStatus: input.httpStatus,
        durationMs: input.durationMs,
        userId: input.userId,
        proposalNum: input.proposalNum,
      },
    });
  } catch (err) {
    logger.error("[AUDIT] Failed to persist Care API log", { err });
  }
};
