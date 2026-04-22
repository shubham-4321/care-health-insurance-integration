import crypto from "crypto";
import { config } from "../config/env";

export const encryptToken = (text: string): string => {
  const key = Buffer.from(config.aesKey, "utf-8");
  const iv = Buffer.from(config.aesIv, "utf-8");

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  return encrypted;
};