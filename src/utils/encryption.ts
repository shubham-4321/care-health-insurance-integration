import crypto from "crypto";

export const encryptToken = (text: string) => {
  const key = Buffer.from(process.env.AES_KEY!, "utf-8"); 
  const iv = Buffer.from(process.env.AES_IV!, "utf-8");    

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  // second base64 encoding
  const finalToken = Buffer.from(encrypted).toString("base64");

  return finalToken;
};