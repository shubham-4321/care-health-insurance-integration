import axios, { AxiosError } from "axios";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { db } from "../config/db";
import {
  persistSession,
  claimToken,
  hasValidTokens,
  invalidateAllSessions,
} from "./tokenManager";
import { encryptToken, generateTimestamp } from "../utils/encryption";
import { withRetry } from "../utils/retry";
import { AppError } from "../middleware/errorHandler";
import { logCareCall } from "./auditLog";
import { mapCareError } from "./careErrors";
import type { CreatePolicyInput } from "../schema/policySchema";

// ─── Care header builder ──────────────────────────────────
// Per Care doc v1.0 page 12/14: appId, signature, applicationCD, agentId
// are Static. Timestamp is also marked Static — we send fresh Date.now()
// which works in UAT (Prashant to confirm against prod).
const buildCareHeaders = (
  extra: Record<string, string> = {},
  withAgentId = false
) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    appId: config.care.appId,
    signature: config.care.signature,
    timestamp: generateTimestamp(),
    applicationCD: config.care.applicationCd,
    ...extra,
  };

  if (withAgentId) {
    headers.agentId = config.care.agentId;
  }

  return headers;
};

// ─── Detect Care token-related failures ───────────────────
const isTokenError = (data: unknown): boolean => {
  if (typeof data !== "object" || data === null) return false;
  const raw = JSON.stringify(data).toLowerCase();
  return (
    raw.includes("invalid token") ||
    raw.includes("session expired") ||
    raw.includes("token validation failed") ||
    raw.includes("token expired")
  );
};

// ─── Check Care's `responseData.status` ───────────────────
// All sample responses wrap success in `{ responseData: { status: "1",
// message: "Success" } }`. Any other status means Care explicitly
// rejected the call — throw so the controller surfaces it.
const assertResponseDataOk = (data: unknown, label: string): void => {
  if (typeof data !== "object" || data === null) return;
  const rd = (data as Record<string, any>).responseData;
  if (!rd || typeof rd !== "object") return;
  if (rd.status !== undefined && rd.status !== "1") {
    logger.error(`[CARE] ${label} responseData not OK`, {
      status: rd.status,
      message: rd.message,
    });
    throw new AppError(
      typeof rd.message === "string" && rd.message.length
        ? `Care error: ${rd.message}`
        : `Care API returned status ${rd.status}`,
      502
    );
  }
};

// ─── Filter malformed tokens out of a Care token batch ────
// Sample generate-token response in the doc had an entry with only
// `tokenKey` and no `tokenValue`. Drop anything that can't be encrypted.
type RawToken = { tokenKey?: unknown; tokenValue?: unknown };
const filterValidTokens = (
  tokens: RawToken[]
): { tokenKey: string; tokenValue: string }[] =>
  tokens.filter(
    (t): t is { tokenKey: string; tokenValue: string } =>
      typeof t?.tokenKey === "string" &&
      t.tokenKey.length > 0 &&
      typeof t?.tokenValue === "string" &&
      t.tokenValue.length > 0
  );

// ─── GST helper ───────────────────────────────────────────
// Care returns premium EXCLUDING GST. FAQ #12: the partner's quotation
// page must display the GST-inclusive figure or createPolicy will fail
// with "premium mismatch". GST on insurance in India is 18%.
const GST_RATE = 0.18;
const round2 = (n: number) => Math.round(n * 100) / 100;
const computeGst = (premiumExGst: number) => {
  const gstAmount = round2(premiumExGst * GST_RATE);
  return {
    gstRate: GST_RATE,
    gstAmount,
    premiumWithGst: round2(premiumExGst + gstAmount),
  };
};

// ─── Inject server-side defaults into createPolicy payload ─
// FAQ #8: `field1` is mandatory for all products. For non-POS partners
// the value must be `PI_<PartnerName>`. The partner's frontend often
// forgets this — fill it in here if missing.
const injectPolicyDefaults = (body: CreatePolicyInput): CreatePolicyInput => ({
  ...body,
  intPolicyDataIO: {
    ...body.intPolicyDataIO,
    policy: {
      ...body.intPolicyDataIO.policy,
      policyAdditionalFieldsDOList:
        body.intPolicyDataIO.policy.policyAdditionalFieldsDOList.map(
          (af, idx) =>
            idx === 0 && !af.field1
              ? { ...af, field1: `PI_${config.care.partnerName}` }
              : af
        ),
    },
  },
});

// ─── Generate Partner Token ───────────────────────────────
export const generatePartnerToken = async (): Promise<{
  success: boolean;
  message: string;
  tokenCount?: number;
}> => {
  logger.info("[CARE] Calling generatePartnerToken");

  if (await hasValidTokens()) {
    return { success: true, message: "Tokens already cached" };
  }

  const url = `${config.care.baseUrl}/generatePartnerToken`;
  const requestBody = {
    partnerTokenGeneratorInputIO: {
      partnerId: config.care.partnerId,
      securityKey: config.care.securityKey,
    },
  };
  const startedAt = Date.now();

  try {
    const res = await withRetry(
      () =>
        axios.post(url, requestBody, {
          headers: buildCareHeaders(),
          timeout: 10000,
        }),
      { label: "generatePartnerToken" }
    );

    const data = res.data;
    const rawTokens: RawToken[] =
      data?.partnerTokenGeneratorInputIO?.listOfToken || [];
    const sessionId = data?.partnerTokenGeneratorInputIO?.sessionId;
    const tokens = filterValidTokens(rawTokens);

    await logCareCall({
      label: "generatePartnerToken",
      url,
      request: requestBody,
      response: data,
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
    });

    assertResponseDataOk(data, "generatePartnerToken");

    if (!tokens.length || !sessionId) {
      logger.error("[CARE] Invalid generatePartnerToken response", {
        rawCount: rawTokens.length,
        validCount: tokens.length,
        hasSessionId: !!sessionId,
      });
      throw new AppError("Invalid token response from Care API", 502);
    }

    if (tokens.length < rawTokens.length) {
      logger.warn("[CARE] Dropped malformed tokens from generatePartnerToken", {
        dropped: rawTokens.length - tokens.length,
      });
    }

    await persistSession(sessionId, tokens);

    return {
      success: true,
      message: "Tokens generated",
      tokenCount: tokens.length,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    await logCareCall({
      label: "generatePartnerToken",
      url,
      request: requestBody,
      response: axiosErr.response?.data,
      httpStatus: axiosErr.response?.status,
      errorMessage: (err as Error).message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
};

// ─── Internal: send a Care request with a fresh token ─────
const callWithToken = async <T>(
  url: string,
  body: unknown,
  withAgentId: boolean,
  label: string,
  meta: { userId?: string; proposalNum?: string } = {}
): Promise<T> => {
  const send = async (): Promise<T> => {
    if (!(await hasValidTokens())) {
      await generatePartnerToken();
    }

    const claimed = await claimToken();
    if (!claimed) {
      throw new AppError("No Care token available", 502);
    }

    const tokenId = encryptToken(claimed.token.tokenKey, claimed.token.tokenValue);
    const startedAt = Date.now();

    try {
      const res = await withRetry(
        () =>
          axios.post(url, body, {
            headers: buildCareHeaders(
              { sessionId: claimed.sessionId, tokenId },
              withAgentId
            ),
            timeout: 15000,
          }),
        { label }
      );

      await logCareCall({
        label,
        url,
        request: body,
        response: res.data,
        httpStatus: res.status,
        durationMs: Date.now() - startedAt,
        userId: meta.userId,
        proposalNum: meta.proposalNum,
      });

      return res.data as T;
    } catch (err) {
      const axiosErr = err as AxiosError;
      await logCareCall({
        label,
        url,
        request: body,
        response: axiosErr.response?.data,
        httpStatus: axiosErr.response?.status,
        errorMessage: (err as Error).message,
        durationMs: Date.now() - startedAt,
        userId: meta.userId,
        proposalNum: meta.proposalNum,
      });
      throw err;
    }
  };

  try {
    let data = await send();

    if (isTokenError(data)) {
      logger.warn(`[CARE] ${label} returned token error — refreshing session`);
      await invalidateAllSessions();
      data = await send();
    }

    assertResponseDataOk(data, label);
    return data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response && isTokenError(axiosErr.response.data)) {
      logger.warn(
        `[CARE] ${label} HTTP error indicates token error — refreshing session`
      );
      await invalidateAllSessions();
      const data = await send();
      assertResponseDataOk(data, label);
      return data;
    }
    throw err;
  }
};

// ─── Surface a useful error to the controller ─────────────
// If Care returned a known-error response, translate it. Otherwise let the
// raw AppError / Axios error bubble up.
const surfaceCareError = (data: unknown): AppError | null => {
  const mapped = mapCareError(data);
  if (!mapped) return null;
  return new AppError(mapped.message, mapped.statusCode);
};

// ─── Calculate Premium (quote only — no persistence) ──────
// Per doc page 6: createPolicy with `isPremiumCalculation = YES` returns
// the premium without creating a real proposal. Use this for quotes.
export const calculatePremium = async (
  body: CreatePolicyInput,
  userId: string
) => {
  logger.info("[CARE] Calling createPolicy for premium quote", { userId });

  // Force the quote flag + inject field1 default.
  const quoteBody: CreatePolicyInput = injectPolicyDefaults({
    ...body,
    intPolicyDataIO: {
      ...body.intPolicyDataIO,
      policy: {
        ...body.intPolicyDataIO.policy,
        isPremiumCalculation: "YES",
      },
    },
  });

  const url = `${config.care.baseUrl}/createPolicy`;

  const data = await callWithToken<Record<string, any>>(
    url,
    quoteBody,
    false,
    "createPolicy(quote)",
    { userId }
  );

  const rawPremium =
    data?.intPolicyDataIO?.policy?.premium ??
    data?.intPolicyDataIO?.policy?.totalPremium;

  const premium =
    typeof rawPremium === "number"
      ? rawPremium
      : typeof rawPremium === "string"
      ? parseFloat(rawPremium)
      : NaN;

  if (!Number.isFinite(premium)) {
    const mapped = surfaceCareError(data);
    if (mapped) throw mapped;
    return { success: false, message: "Premium not returned", raw: data };
  }

  return {
    success: true,
    premium, // GST-EXCLUSIVE (Care's raw figure)
    ...computeGst(premium),
    raw: data,
  };
};

// ─── Create Policy (real proposal — persists) ─────────────
export const createPolicy = async (
  body: CreatePolicyInput,
  userId: string
) => {
  logger.info("[CARE] Calling createPolicy", { userId });

  // Idempotency: if the partner sent the same loanAccNum again, return the
  // existing proposal instead of submitting a duplicate to Care.
  const existing = await db.proposal.findUnique({
    where: { loanAccNum: body.intPolicyDataIO.policy.loanAccNum },
  });
  if (existing) {
    if (existing.userId !== userId) {
      throw new AppError("Loan account number is already in use", 409);
    }
    logger.info("[CARE] createPolicy idempotent — returning existing proposal", {
      proposalNum: existing.proposalNum,
    });
    return {
      success: true,
      proposalNum: existing.proposalNum,
      idempotent: true,
    };
  }

  const url = `${config.care.baseUrl}/createPolicy`;

  // Inject server-side defaults (field1 = PI_<PartnerName>) before sending.
  const enrichedBody = injectPolicyDefaults(body);

  const data = await callWithToken<Record<string, any>>(
    url,
    enrichedBody,
    false,
    "createPolicy",
    { userId }
  );

  const proposalNum = data?.intPolicyDataIO?.policy?.proposalNum;

  if (!proposalNum) {
    logger.error("[CARE] createPolicy returned no proposalNum", {
      response: data,
    });
    const mapped = surfaceCareError(data);
    if (mapped) throw mapped;
    return {
      success: false,
      message: "Proposal creation failed",
      raw: data,
    };
  }

  const policyBody = enrichedBody.intPolicyDataIO.policy;
  const proposerGuid = policyBody.partyDOList[0].guid;
  const premium = data?.intPolicyDataIO?.policy?.premium;

  await db.proposal.create({
    data: {
      userId,
      proposalNum,
      proposerGuid,
      loanAccNum: policyBody.loanAccNum,
      loanAmount: parseFloat(policyBody.loanAmount),
      loanTenure: parseInt(policyBody.loanTenure, 10),
      loanTenureUnit: policyBody.loanTenureUnitCd,
      loanDisbursalDt: policyBody.loanDisbursalDt,
      coverType: policyBody.coverType,
      sumInsured: policyBody.sumInsured,
      term: parseInt(policyBody.term, 10),
      addOns: policyBody.addOns,
      baseProductId: policyBody.baseProductId,
      premium: typeof premium === "number" ? premium : undefined,
      rawRequest: enrichedBody as object,
      rawResponse: data as object,
    },
  });

  logger.info("[CARE] createPolicy success — proposal persisted", {
    proposalNum,
    userId,
  });

  return {
    success: true,
    proposalNum,
    premium,
    raw: data,
  };
};

// ─── Get Policy Status ────────────────────────────────────
// Request:  { intGetPolicyStatusIO: { proposalNum } }
// Response: { intGetPolicyStatusIO: { policyNum, policyStatus,
//             policyCommencementDt, policyMaturityDt, policyPremium, ... } }
export const getPolicyStatus = async (
  proposalNum: string,
  userId?: string
) => {
  logger.info("[CARE] Calling getPolicyStatusV2", { proposalNum });

  const url = `${config.care.baseUrl}/getPolicyStatusV2`;

  const data = await callWithToken<Record<string, any>>(
    url,
    { intGetPolicyStatusIO: { proposalNum } },
    true,
    "getPolicyStatusV2",
    { userId, proposalNum }
  );

  const io = data?.intGetPolicyStatusIO ?? {};

  return {
    success: true,
    status: typeof io.policyStatus === "string" ? io.policyStatus : null,
    policyNum: io.policyNum ?? null,
    commencementDt: io.policyCommencementDt ?? null,
    maturityDt: io.policyMaturityDt ?? null,
    premium: typeof io.policyPremium === "number" ? io.policyPremium : null,
    raw: data,
  };
};

// ─── Get Policy PDF ───────────────────────────────────────
// Request:  { intFaveoGetPolicyPDFIO: { policyNum, ltype: "POLSCHD" } }
// Response: { intFaveoGetPolicyPDFIO: { policyNum, dataPDF, ltype,
//             policyPDFStatus, parentAgentId } }
// `dataPDF` is base64 of the PDF bytes.
export const getPolicyPDF = async (policyNum: string, userId?: string) => {
  logger.info("[CARE] Calling getPolicyPDFV2", { policyNum });

  const url = `${config.care.baseUrl}/getPolicyPDFV2`;

  const data = await callWithToken<Record<string, any>>(
    url,
    { intFaveoGetPolicyPDFIO: { policyNum, ltype: "POLSCHD" } },
    true,
    "getPolicyPDFV2",
    { userId }
  );

  const io = data?.intFaveoGetPolicyPDFIO ?? {};
  const pdfBase64 = typeof io.dataPDF === "string" ? io.dataPDF : null;

  return {
    success: true,
    pdfBase64,
    pdfUrl: null,
    pdfStatus: typeof io.policyPDFStatus === "string" ? io.policyPDFStatus : null,
    raw: data,
  };
};
