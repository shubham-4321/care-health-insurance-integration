import { db } from "../config/db";
import { logger } from "../config/logger";
import { getPolicyStatus } from "./careApi";
import type { ProposalStatus } from "@prisma/client";

// ─── Care status string → our enum ────────────────────────
// Per doc page 14. Strings are matched case-insensitively and tolerate
// minor wording differences ("Pending Tele Q" vs "Pending TeleQ" etc.)
const mapCareStatus = (raw: unknown): ProposalStatus | null => {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();

  if (s.includes("inforce")) return "INFORCE";
  if (s.includes("declined")) return "DECLINED";
  if (s.includes("pending tele")) return "PENDING_UW";
  if (s.includes("pending application entry")) return "PAYMENT_PENDING";
  if (s.includes("pending cpu")) return "PENDING_UW";
  if (s.includes("mark for cancellation")) return "DECLINED";

  return null;
};

// ─── Reconcile a single proposal with Care ────────────────
// Used after a payment timeout, or by a cron for stuck proposals.
// Per doc page 17: if status is "Pending Application Entry" after a
// payment attempt, we should re-hit payment, so we surface a flag.
export const reconcileProposal = async (
  proposalNum: string
): Promise<{
  proposalNum: string;
  careStatus: string | null;
  mappedStatus: ProposalStatus | null;
  needsPaymentRetry: boolean;
}> => {
  const proposal = await db.proposal.findUnique({ where: { proposalNum } });
  if (!proposal) {
    return {
      proposalNum,
      careStatus: null,
      mappedStatus: null,
      needsPaymentRetry: false,
    };
  }

  const careResp = await getPolicyStatus(proposalNum, proposal.userId);
  const mapped = mapCareStatus(careResp.status);

  if (mapped && mapped !== proposal.status) {
    await db.proposal.update({
      where: { id: proposal.id },
      data: { status: mapped },
    });
    logger.info("[RECONCILE] Updated proposal status", {
      proposalNum,
      from: proposal.status,
      to: mapped,
    });
  }

  // Doc page 17 — only "Pending Application Entry" after payment means
  // we should re-hit payment.
  const needsPaymentRetry =
    typeof careResp.status === "string" &&
    careResp.status.toLowerCase().includes("pending application entry") &&
    (proposal.status === "PAYMENT_INITIATED" ||
      proposal.status === "PAYMENT_PENDING");

  return {
    proposalNum,
    careStatus: typeof careResp.status === "string" ? careResp.status : null,
    mappedStatus: mapped,
    needsPaymentRetry,
  };
};

// ─── Reconcile all stuck proposals ────────────────────────
// Intended to be run on a cron (e.g. every 15 minutes). Picks proposals
// that aren't in a final state and asks Care for their current status.
export const reconcileStuckProposals = async (
  olderThanMinutes = 5
): Promise<{ checked: number; updated: number }> => {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const candidates = await db.proposal.findMany({
    where: {
      status: { in: ["PAYMENT_INITIATED", "PAYMENT_SUCCESS", "PENDING_UW"] },
      updatedAt: { lt: cutoff },
    },
    take: 50,
  });

  let updated = 0;
  for (const p of candidates) {
    try {
      const result = await reconcileProposal(p.proposalNum);
      if (result.mappedStatus && result.mappedStatus !== p.status) {
        updated += 1;
      }
    } catch (err) {
      logger.error("[RECONCILE] Failed for proposal", {
        proposalNum: p.proposalNum,
        err,
      });
    }
  }

  return { checked: candidates.length, updated };
};
