import winston from "winston";
import path from "path";
import fs from "fs";

// ─── Ensure logs directory exists ─────────────────────────
const logDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ─── Sensitive keys to never log ──────────────────────────
const REDACT_KEYS = [
  "password",
  "token",
  "tokenValue",
  "signature",
  "aesKey",
  "aesIv",
  "securityKey",
  "authorization",
  "refreshToken",
];

// ─── Redact sensitive fields recursively ──────────────────
const redact = (obj: unknown): unknown => {
  try {
    if (typeof obj !== "object" || obj === null) return obj;
    return JSON.parse(
      JSON.stringify(obj, (key, value) =>
        REDACT_KEYS.some((k) =>
          key.toLowerCase().includes(k.toLowerCase())
        )
          ? "[REDACTED]"
          : value
      )
    );
  } catch {
    return "[UNSERIALIZABLE]";
  }
};

// ─── Log format ────────────────────────────────────────────
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    try {
      const metaStr =
        Object.keys(meta).length
          ? `\n${JSON.stringify(redact(meta), null, 2)}`
          : "";
      return `[${timestamp}] ${level.toUpperCase()}: ${
        stack || message
      }${metaStr}`;
    } catch {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    }
  })
);

// ─── Create logger instance ────────────────────────────────
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  format: logFormat,
  transports: [
    // Console — colored in dev
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        logFormat
      ),
    }),

    // All logs → app.log (max 10MB, keeps last 5 files)
    new winston.transports.File({
      filename: path.join(logDir, "app.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),

    // Errors only → error.log
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

// ─── Helper: log Care API calls cleanly ───────────────────
export const logCareApiCall = (
  direction: "OUTBOUND" | "INBOUND",
  endpoint: string,
  data: Record<string, unknown>
): void => {
  try {
    logger.debug(`[CARE API ${direction}] ${endpoint}`, {
      data: redact(data),
    });
  } catch (err) {
    logger.error("[LOGGER] Failed to log Care API call", { err });
  }
};