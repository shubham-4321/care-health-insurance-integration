import { db } from "../config/db";
import { logger } from "../config/logger";

// ─── Care session window ──────────────────────────────────
// Per Care doc v1.0 page 5: each generatePartnerToken response is valid
// for 15 minutes and contains exactly 25 single-use tokens.
const SESSION_TTL_MS = 15 * 60 * 1000;
// Conservative safety margin — refresh a little before Care expires it
const SESSION_SAFETY_MS = 30 * 1000;

export type CareTokenItem = {
  tokenKey: string;
  tokenValue: string;
};

// ─── Persist a fresh Care session + token batch ───────────
// Called after a successful generatePartnerToken response.
// Defensively re-filters tokens — the sample response in the Care doc had
// a malformed entry missing `tokenValue`, so we belt-and-braces guard
// against persisting nulls.
export const persistSession = async (
  sessionId: string,
  tokens: CareTokenItem[]
): Promise<void> => {
  const valid = tokens.filter(
    (t) =>
      t &&
      typeof t.tokenKey === "string" &&
      t.tokenKey.length > 0 &&
      typeof t.tokenValue === "string" &&
      t.tokenValue.length > 0
  );

  if (!valid.length) {
    logger.error("[CARE TOKEN] persistSession called with no valid tokens", {
      sessionId,
      rawCount: tokens.length,
    });
    throw new Error("Refusing to persist Care session with zero valid tokens");
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.careSession.create({
    data: {
      sessionId,
      expiresAt,
      tokens: {
        create: valid.map((t) => ({
          tokenKey: t.tokenKey,
          tokenValue: t.tokenValue,
        })),
      },
    },
  });

  logger.info("[CARE TOKEN] Session persisted", {
    sessionId,
    tokenCount: valid.length,
    expiresAt,
  });
};

// ─── Find an active session with unused tokens ────────────
// Returns the most recently created non-expired session that still has
// at least one unused token, otherwise null.
const findActiveSession = async () => {
  const cutoff = new Date(Date.now() + SESSION_SAFETY_MS);

  return db.careSession.findFirst({
    where: {
      expiresAt: { gt: cutoff },
      tokens: { some: { isUsed: false } },
    },
    orderBy: { createdAt: "desc" },
  });
};

// ─── Do we currently have a usable token cached? ──────────
export const hasValidTokens = async (): Promise<boolean> => {
  const session = await findActiveSession();
  return session !== null;
};

// ─── Atomically claim one unused token from an active session ─
// Returns null if no token is available — caller must refresh.
export const claimToken = async (): Promise<
  { sessionId: string; token: CareTokenItem } | null
> => {
  return db.$transaction(async (tx) => {
    const cutoff = new Date(Date.now() + SESSION_SAFETY_MS);

    const session = await tx.careSession.findFirst({
      where: {
        expiresAt: { gt: cutoff },
        tokens: { some: { isUsed: false } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session) return null;

    const token = await tx.careToken.findFirst({
      where: { sessionId: session.id, isUsed: false },
      orderBy: { createdAt: "asc" },
    });

    if (!token) return null;

    await tx.careToken.update({
      where: { id: token.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    return {
      sessionId: session.sessionId,
      token: { tokenKey: token.tokenKey, tokenValue: token.tokenValue },
    };
  });
};

// ─── Invalidate everything (e.g. on "Session Expired" from Care) ─
// Cascade deletes tokens via the FK relation.
export const invalidateAllSessions = async (): Promise<void> => {
  const result = await db.careSession.deleteMany({});
  logger.warn("[CARE TOKEN] All sessions invalidated", {
    deleted: result.count,
  });
};
