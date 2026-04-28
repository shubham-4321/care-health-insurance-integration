import rateLimit from "express-rate-limit";
import { config } from "../config/env";
import { logger } from "../config/logger";

// ─── General Rate Limiter ──────────────────────────────────
// Applied to all routes
// 100 requests per minute per IP by default
export const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,  // Return rate limit info in headers
  legacyHeaders: false,
  skipSuccessfulRequests: false,

  // Custom handler — logs the abuse attempt
  handler: (req, res) => {
    try {
      logger.warn("[RATE LIMIT] General limit exceeded", {
        ip: req.ip,
        method: req.method,
        url: req.url,
      });

      res.status(429).json({
        success: false,
        message: "Too many requests. Please slow down and try again later.",
      });
    } catch (err) {
      logger.error("[RATE LIMIT] Handler error", { err });
      res.status(429).json({
        success: false,
        message: "Too many requests.",
      });
    }
  },
});

// ─── Strict Rate Limiter ───────────────────────────────────
// Applied to auth routes only (login, register)
// 10 requests per minute per IP
// Prevents brute force password attacks
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,

  handler: (req, res) => {
    try {
      logger.warn("[RATE LIMIT] Auth limit exceeded — possible brute force", {
        ip: req.ip,
        method: req.method,
        url: req.url,
      });

      res.status(429).json({
        success: false,
        message:
          "Too many login attempts. Please wait a minute and try again.",
      });
    } catch (err) {
      logger.error("[RATE LIMIT] Auth handler error", { err });
      res.status(429).json({
        success: false,
        message: "Too many requests.",
      });
    }
  },
});

// ─── Insurance Rate Limiter ────────────────────────────────
// Applied to createPolicy and payment routes
// 20 requests per minute per IP
// Prevents accidental duplicate proposal creation
export const insuranceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,

  handler: (req, res) => {
    try {
      logger.warn("[RATE LIMIT] Insurance limit exceeded", {
        ip: req.ip,
        method: req.method,
        url: req.url,
      });

      res.status(429).json({
        success: false,
        message: "Too many insurance requests. Please try again shortly.",
      });
    } catch (err) {
      logger.error("[RATE LIMIT] Insurance handler error", { err });
      res.status(429).json({
        success: false,
        message: "Too many requests.",
      });
    }
  },
});