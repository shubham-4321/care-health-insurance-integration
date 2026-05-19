import { Request, Response } from "express";
import { createPolicySchema } from "../schema/policySchema";
import {
  generatePartnerToken,
  createPolicy,
  calculatePremium,
  getPolicyStatus,
  getPolicyPDF,
} from "../services/careApi";
import {
  buildPaymentFormFields,
  handlePaymentCallback,
} from "../services/paymentService";
import { logger } from "../config/logger";
import { config } from "../config/env";
import { AppError } from "../middleware/errorHandler";

// ─── Helpers ──────────────────────────────────────────────
const requireUserId = (req: Request, res: Response): string | null => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return null;
  }
  return userId;
};

const handleError = (err: unknown, res: Response, label: string): void => {
  const error = err as { statusCode?: number; message?: string };
  logger.error(`[CONTROLLER] ${label} failed`, { err });
  res.status(error instanceof AppError ? error.statusCode! : 500).json({
    success: false,
    message: error.message || `${label} failed`,
  });
};

// ─── Refresh Care partner token cache ─────────────────────
export const generateTokenController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await generatePartnerToken();
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res, "generateToken");
  }
};

// ─── Premium Quote ────────────────────────────────────────
// POST /api/v1/policy/quote
// Calls Care with isPremiumCalculation=YES — returns premium without
// creating a real proposal. Use this before "Pay Now".
export const premiumQuoteController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = createPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await calculatePremium(parsed.data, userId);
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res, "premiumQuote");
  }
};

// ─── Create Policy ────────────────────────────────────────
export const createPolicyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = createPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await createPolicy(parsed.data, userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    handleError(err, res, "createPolicy");
  }
};

// ─── Payment: build form fields ───────────────────────────
export const paymentInitController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const proposalNum = (req.body?.proposalNum as string | undefined)?.trim();
    if (!proposalNum) {
      res.status(400).json({
        success: false,
        message: "proposalNum is required",
      });
      return;
    }

    const fields = await buildPaymentFormFields(proposalNum, userId);
    res.status(200).json({ success: true, fields });
  } catch (err) {
    handleError(err, res, "paymentInit");
  }
};

// ─── Payment: callback from Care ──────────────────────────
// PUBLIC endpoint. After processing, redirects the user's browser
// to the partner's frontend success/failure URL — Care's callback is
// followed by a browser redirect, not consumed by a server.
const buildRedirectUrl = (
  template: string,
  vars: Record<string, string | undefined>
): string => {
  let url = template;
  for (const [key, value] of Object.entries(vars)) {
    url = url.replace(`{${key}}`, encodeURIComponent(value ?? ""));
  }
  return url;
};

export const paymentCallbackController = async (
  req: Request,
  res: Response
): Promise<void> => {
  let proposalNum: string | undefined;
  try {
    proposalNum =
      ((req.query?.proposalNum as string | undefined) ||
        (req.body?.proposalNum as string | undefined))?.trim();

    if (!proposalNum) {
      logger.error("[CONTROLLER] paymentCallback missing proposalNum", {
        query: req.query,
        body: req.body,
      });
      res.status(400).send("Missing proposalNum");
      return;
    }

    const result = await handlePaymentCallback({
      proposalNum,
      PNO: req.body?.PNO,
      TXNREFNO: req.body?.TXNREFNO,
      UWC: req.body?.UWC,
      ERRFLG: req.body?.ERRFLG,
      ERRMSG: req.body?.ERRMSG,
      receiptNum: req.body?.receiptNum,
    });

    if (result.success) {
      const target = buildRedirectUrl(config.frontend.successUrl, {
        policyNum: result.policyNum ?? "",
        proposalNum,
      });
      res.redirect(302, target);
      return;
    }

    const target = buildRedirectUrl(config.frontend.failureUrl, {
      proposalNum,
      reason: (req.body?.ERRMSG as string | undefined) ?? "PAYMENT_FAILED",
    });
    res.redirect(302, target);
  } catch (err) {
    logger.error("[CONTROLLER] paymentCallback failed", { err });
    const target = buildRedirectUrl(config.frontend.failureUrl, {
      proposalNum: proposalNum ?? "",
      reason: "INTERNAL_ERROR",
    });
    res.redirect(302, target);
  }
};

// ─── Proposal Status ──────────────────────────────────────
export const proposalStatusController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const proposalNum = req.params.proposalNum?.trim();
    if (!proposalNum) {
      res.status(400).json({ success: false, message: "proposalNum is required" });
      return;
    }

    const result = await getPolicyStatus(proposalNum, userId);
    res.status(200).json(result);
  } catch (err) {
    handleError(err, res, "proposalStatus");
  }
};

// ─── Policy PDF (COI) ─────────────────────────────────────
// If Care returns base64, we stream it as application/pdf so the browser
// downloads/views it directly. If Care returns a URL, we 302-redirect.
// JSON fallback if neither is present.
export const policyPdfController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const policyNum = req.params.policyNum?.trim();
    if (!policyNum) {
      res.status(400).json({ success: false, message: "policyNum is required" });
      return;
    }

    const result = await getPolicyPDF(policyNum, userId);

    if (result.pdfBase64 && typeof result.pdfBase64 === "string") {
      const buffer = Buffer.from(result.pdfBase64, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="policy-${policyNum}.pdf"`
      );
      res.send(buffer);
      return;
    }

    if (result.pdfUrl && typeof result.pdfUrl === "string") {
      res.redirect(302, result.pdfUrl);
      return;
    }

    res.status(404).json({
      success: false,
      message: "Policy PDF not available yet. Policy may not be INFORCE.",
      raw: result.raw,
    });
  } catch (err) {
    handleError(err, res, "policyPdf");
  }
};
