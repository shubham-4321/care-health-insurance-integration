import dotenv from "dotenv";
dotenv.config();

// ─── Helper: crash immediately if a required var is missing ───
function required(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[CONFIG] Missing required environment variable: ${key}. Add it to your .env file.`
    );
  }
  return value.trim();
}

function optional(key: string, fallback: string): string {
  return process.env[key]?.trim() || fallback;
}

export const config = {
  app: {
    port: parseInt(optional("PORT", "3000"), 10),
    nodeEnv: optional("NODE_ENV", "development"),
    isProduction: optional("NODE_ENV", "development") === "production",
  },

  db: {
    url: required("DATABASE_URL"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "15m"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "7d"),
  },

  care: {
    baseUrl: required("CARE_BASE_URL"),
    appId: required("CARE_APP_ID"),
    signature: required("CARE_SIGNATURE"),
    agentId: optional("CARE_AGENT_ID", "20008325"),
    applicationCd: optional("CARE_APPLICATION_CD", "PARTNERAPP"),
    partnerId: required("CARE_PARTNER_ID"),
    securityKey: required("CARE_SECURITY_KEY"),
    aesKey: required("AES_KEY"),
    aesIv: required("AES_IV"),
    paymentUrl: required("CARE_PAYMENT_URL"),
    partnerName: optional("PARTNER_NAME", "PARTNER"),
    returnUrl: required("RETURN_URL"),
  },

  security: {
    rateLimitWindowMs: parseInt(optional("RATE_LIMIT_WINDOW_MS", "60000"), 10),
    rateLimitMax: parseInt(optional("RATE_LIMIT_MAX", "100"), 10),
    allowedOrigins: optional("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
  },
} as const;

export type Config = typeof config;