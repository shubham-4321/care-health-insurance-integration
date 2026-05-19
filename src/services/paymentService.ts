import { db } from "../config/db";
import { logger } from "../config/logger";
import { config } from "../config/env";
import { encryptProposalNumber } from "../utils/encryption";
import { AppError } from "../middleware/errorHandler";

// ─── Build payment form fields ────────────────────────────
// Per Care doc v1.0 page 9: the partner posts a form to PortalPaymentV2.run
// with CSRF (proposer guid), encrypted proposalNum, source, returnURL.
//
// We append the plain proposalNum to the returnURL as a query param so the
// callback handler can correlate Care's response (which only contains PNO
// and TXNREFNO, not the proposalNum) back to our DB row.
export const buildPaymentFormFields = async (
  proposalNum: string,
  userId: string
) => {
  const proposal = await db.proposal.findUnique({
    where: { proposalNum },
  });

  if (!proposal) {
    throw new AppError("Proposal not found", 404);
  }

  if (proposal.userId !== userId) {
    throw new AppError("Forbidden: proposal belongs to another user", 403);
  }

  const encryptedProposalNum = encryptProposalNumber(proposalNum);

  const returnUrl = new URL(config.care.returnUrl);
  returnUrl.searchParams.set("proposalNum", proposalNum);

  // `source` is the literal string "PARTNER" per Care doc page 10 + the
  // sample CHI Payment Gateway HTML — NOT the partner's brand name.
  const fields = {
    action: config.care.paymentUrl,
    CSRF: proposal.proposerGuid,
    proposalNum: encryptedProposalNum,
    source: "PARTNER",
    returnURL: returnUrl.toString(),
  };

  await db.proposal.update({
    where: { id: proposal.id },
    data: { status: "PAYMENT_INITIATED" },
  });

  logger.info("[PAYMENT] Form fields generated", {
    proposalNum,
    userId,
  });

  return fields;
};

// ─── Handle Care's payment callback ───────────────────────
// Care POSTs back: PNO, TXNREFNO, UWC, ERRFLG, ERRMSG, receiptNum.
// We correlate via proposalNum query param added in buildPaymentFormFields.
//
// uwDecision interpretation (doc page 10):
//   INFORCE + blank err → policy issued
//   PENDINGFORMANUALUW / PENDINGREQUIREMENTS + blank err → under UW review
//   non-blank ERRFLG → payment / data failure
export type PaymentCallbackInput = {
  proposalNum: string;
  PNO?: string;
  TXNREFNO?: string;
  UWC?: string;
  ERRFLG?: string;
  ERRMSG?: string;
  receiptNum?: string;
};

export const handlePaymentCallback = async (input: PaymentCallbackInput) => {
  const proposal = await db.proposal.findUnique({
    where: { proposalNum: input.proposalNum },
  });

  if (!proposal) {
    logger.error("[PAYMENT] Callback for unknown proposal", {
      proposalNum: input.proposalNum,
    });
    throw new AppError("Unknown proposal", 404);
  }

  const hasError = Boolean(input.ERRFLG && input.ERRFLG.trim().length > 0);
  const uw = input.UWC?.trim().toUpperCase();

  let paymentStatus: "SUCCESS" | "FAILED" | "UNKNOWN";
  let proposalStatus:
    | "PAYMENT_SUCCESS"
    | "PAYMENT_FAILED"
    | "INFORCE"
    | "PENDING_UW";

  if (hasError) {
    paymentStatus = "FAILED";
    proposalStatus = "PAYMENT_FAILED";
  } else if (uw === "INFORCE") {
    paymentStatus = "SUCCESS";
    proposalStatus = "INFORCE";
  } else if (uw === "PENDINGFORMANUALUW" || uw === "PENDINGREQUIREMENTS") {
    paymentStatus = "SUCCESS";
    proposalStatus = "PENDING_UW";
  } else {
    paymentStatus = "UNKNOWN";
    proposalStatus = "PAYMENT_SUCCESS";
  }

  await db.$transaction([
    db.paymentRecord.create({
      data: {
        proposalId: proposal.id,
        proposalNum: proposal.proposalNum,
        policyNum: input.PNO,
        txnRefNum: input.TXNREFNO,
        receiptNum: input.receiptNum,
        uwDecision: input.UWC,
        errorFlag: input.ERRFLG,
        errorMessage: input.ERRMSG,
        status: paymentStatus,
        rawResponse: input as unknown as object,
      },
    }),
    db.proposal.update({
      where: { id: proposal.id },
      data: { status: proposalStatus },
    }),
  ]);

  if (proposalStatus === "INFORCE" && input.PNO) {
    await db.policy.upsert({
      where: { proposalId: proposal.id },
      create: {
        proposalId: proposal.id,
        proposalNum: proposal.proposalNum,
        policyNum: input.PNO,
        policyStatus: "INFORCE",
        premium: proposal.premium ?? 0,
      },
      update: {
        policyNum: input.PNO,
        policyStatus: "INFORCE",
      },
    });
  }

  logger.info("[PAYMENT] Callback processed", {
    proposalNum: proposal.proposalNum,
    paymentStatus,
    proposalStatus,
    PNO: input.PNO,
  });

  return {
    success: !hasError,
    paymentStatus,
    proposalStatus,
    policyNum: input.PNO || null,
  };
};
