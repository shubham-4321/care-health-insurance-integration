import axios from "axios";
import { config } from "../config/env";
import { setTokens, hasValidTokens, getToken, getSessionId } from "./tokenManager";
import { encryptToken } from "../utils/encryption";
import logger from "../utils/logger";
import { withRetry } from "../utils/retry";

type Token = {
  tokenKey: string;
  tokenValue: string;
};

export const generatePartnerToken = async (body: any, headers: any) => {
  logger.info("Calling Care API: generatePartnerToken");

  // -----------------------------
  // Token cache check
  // -----------------------------
  if (hasValidTokens()) {
    return { message: "Tokens already available" };
  }

  // -----------------------------
  // Extract body
  // -----------------------------
  const input = body.partnerTokenGeneratorInputIO;

  // -----------------------------
  // Extract headers (Express lowercases everything)
  // -----------------------------
  const h = headers as Record<string, any>;

  const appId = h["appid"];
  const signature = h["signature"];
  const timestamp = h["timestamp"];
  const applicationCD = h["applicationcd"];

  if (!appId || !signature || !timestamp || !applicationCD) {
    throw new Error("Missing required headers");
  }

  const url = `${config.baseUrl}/generatePartnerToken`;

  // -----------------------------
  // API call with retry (important for 406)
  // -----------------------------
  const res = await withRetry(() =>
    axios.post(
      url,
      {
        partnerTokenGeneratorInputIO: input,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          appId,
          signature,
          timestamp,
          applicationCD,
        },
        timeout: 10000,
      }
    )
  );

  const data = res.data;

  const tokens = data?.partnerTokenGeneratorInputIO?.listOfToken || [];
  const sessionId = data?.partnerTokenGeneratorInputIO?.sessionId;

  if (!tokens.length || !sessionId) {
    throw new Error("Invalid token response from Care API");
  }

  // store tokens
  setTokens(tokens, sessionId);

  logger.info({
    msg: "Tokens stored successfully",
    tokenCount: tokens.length,
  });

  return data;
};

export const  createPolicy = async (body: any, headers: any) => {
  logger.info({ msg: "Calling Care API: createPolicy" });

  // -----------------------------
  // Check token availability
  // -----------------------------
  if (!hasValidTokens()) {
    throw new Error("No valid tokens available. Call generateToken first.");
  }

  // -----------------------------
  // Get token + session
  // -----------------------------
  const token = getToken();
  const sessionId = getSessionId();

  if (!token || !sessionId) {
    throw new Error("Token or session missing");
  }

  console.log("Using token:", token);
  console.log("Session ID:", sessionId);

  // -----------------------------
  // Encrypt tokenId
  // -----------------------------
  const raw = `${token.tokenKey}|${token.tokenValue}`;
  const tokenId = encryptToken(raw);
  console.log("RAW TOKEN:", raw);
  console.log("TOKEN KEY:", token.tokenKey);
  console.log("TOKEN VALUE:", token.tokenValue);

  console.log("Encrypted tokenId:", tokenId);

  // -----------------------------
  // Extract headers (lowercase)
  // -----------------------------
  const h = headers as Record<string, any>;

  const appId = h["appid"];
  const signature = h["signature"];
  const timestamp = h["timestamp"];
  const applicationCD = h["applicationcd"];

  if (!appId || !signature || !timestamp || !applicationCD) {
    throw new Error("Missing required headers");
  }

  // -----------------------------
  // API call
  // -----------------------------
  console.log("Final Request Payload:", JSON.stringify(body, null, 2));
  const url = `${config.baseUrl}/createPolicy`;

  const res = await withRetry(() =>
    axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        appId,
        signature,
        timestamp,
        sessionId,
        tokenId,
        applicationCD,
      },
      timeout: 10000,
    })
  );

  // -----------------------------
  // Extract proposal number
  // -----------------------------
  const proposalNo =
    res.data?.intPolicyDataIO?.policy?.proposalNum;
    if (!proposalNo) {
      logger.error({
        msg: "Proposal creation failed",
        response: res.data,
      });

      console.log("API Failure Response:", JSON.stringify(res.data, null, 2));

      return {
        success: false,
        error: res.data,
      };
    }

  // -----------------------------
  // Logging
  // -----------------------------
  console.log("Full API Response:", JSON.stringify(res.data, null, 2));
  console.log("Proposal Number:", proposalNo);

  logger.info({
    msg: "createPolicy success",
    proposalNo,
  });

  // -----------------------------
  // Return clean response
  // -----------------------------
  return {
    success: true,
    proposalNo,
    raw: res.data,
  };
};