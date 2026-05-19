// ─── Care error message mapping ───────────────────────────
// Maps the strings Care returns (doc page 8) into user-friendly responses
// and HTTP status codes the partner frontend can branch on.

type Mapped = {
  message: string;
  statusCode: number;
  code: string;
};

const RULES: Array<{ match: RegExp; mapped: Mapped }> = [
  {
    match: /please enter proper pin code/i,
    mapped: {
      code: "INVALID_PINCODE",
      message: "Pincode must be exactly 6 digits with no leading/trailing spaces.",
      statusCode: 400,
    },
  },
  {
    match: /at least one dependent/i,
    mapped: {
      code: "INVALID_COVER_MEMBERS",
      message: "Sum insured plan and member selection don't match. Pick a different plan or member count.",
      statusCode: 400,
    },
  },
  {
    match: /temporary error has occurred|backend application.*down/i,
    mapped: {
      code: "CARE_UPSTREAM_DOWN",
      message: "Care's backend is temporarily unavailable. Please retry in a few seconds.",
      statusCode: 503,
    },
  },
  {
    match: /system encountered while transforming/i,
    mapped: {
      code: "INVALID_INPUT_VALUE",
      message: "One of the submitted values doesn't match Care's master data. Check codes/case/date format.",
      statusCode: 400,
    },
  },
  {
    match: /invalid token|session expired|token validation failed|token expired/i,
    mapped: {
      code: "CARE_TOKEN_INVALID",
      message: "Care session token is no longer valid. The server is regenerating it — please retry.",
      statusCode: 502,
    },
  },
  {
    match: /duplicate inward no/i,
    mapped: {
      code: "DUPLICATE_TRANSACTION",
      message: "This transaction was already submitted. Use a fresh transaction number.",
      statusCode: 409,
    },
  },
  {
    match: /insufficient balance/i,
    mapped: {
      code: "INSUFFICIENT_BALANCE",
      message: "Float account balance is low. Top up before retrying.",
      statusCode: 402,
    },
  },
];

export const mapCareError = (raw: unknown): Mapped | null => {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  for (const rule of RULES) {
    if (rule.match.test(text)) return rule.mapped;
  }
  return null;
};
