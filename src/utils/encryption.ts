import crypto from "crypto";
import { config } from "../config/env";
import { logger } from "../config/logger";

// ─── Validate key/IV lengths before any encryption ────────
const validateAesConfig = (): { key: Buffer; iv: Buffer } => {
  try {
    const key = Buffer.from(config.care.aesKey, "utf-8");
    const iv = Buffer.from(config.care.aesIv, "utf-8");

    if (key.length !== 32) {
      throw new Error(
        `AES_KEY must be exactly 32 bytes. Current length: ${key.length}`
      );
    }

    if (iv.length !== 16) {
      throw new Error(
        `AES_IV must be exactly 16 bytes. Current length: ${iv.length}`
      );
    }

    return { key, iv };
  } catch (err) {
    logger.error("[ENCRYPTION] AES config validation failed", { err });
    throw err;
  }
};

// ─── Token Encryption ──────────────────────────────────────
// Used in every Care Health API request header as tokenId
// Flow: "tokenKey|tokenValue" → AES-256-CBC → Base64 → Base64 again
// Double Base64 confirmed working with Care Health UAT
export const encryptToken = (
  tokenKey: string,
  tokenValue: string
): string => {
  try {
    const { key, iv } = validateAesConfig();

    const plaintext = `${tokenKey}|${tokenValue}`;

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Double Base64 — confirmed required by Care Health
    const doubleEncoded = Buffer.from(encrypted).toString("base64");

    return doubleEncoded;
  } catch (err) {
    logger.error("[ENCRYPTION] Token encryption failed", { err });
    throw new Error("Failed to encrypt token. Check AES_KEY and AES_IV in .env");
  }
};

// ─── Proposal Number Encryption ───────────────────────────
// Used when redirecting to Care Health payment gateway
// Flow: proposalNum → AES-256-CBC → Base64 (single — not double)
export const encryptProposalNumber = (proposalNum: string): string => {
  try {
    const { key, iv } = validateAesConfig();

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(proposalNum, "utf8", "base64");
    encrypted += cipher.final("base64");

    return encrypted;
  } catch (err) {
    logger.error("[ENCRYPTION] Proposal number encryption failed", {
      err,
    });
    throw new Error("Failed to encrypt proposal number");
  }
};

// ─── Generate timestamp for Care API headers ───────────────
// Fresh timestamp on every request — never hardcoded
export const generateTimestamp = (): string => {
  try {
    return Date.now().toString();
  } catch (err) {
    logger.error("[ENCRYPTION] Timestamp generation failed", { err });
    throw new Error("Failed to generate timestamp");
  }
};