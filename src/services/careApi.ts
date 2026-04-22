import axios from "axios";
import { config } from "../config/env";
import { setTokens, getToken } from "./tokenManager";
import { encryptToken } from "../utils/encryption";
import logger from "../utils/logger";

type Token = {
  tokenKey: string;
  tokenValue: string;
};

// 1. Generate Tokens
export const generatePartnerToken = async (body: any) => {
  logger.info("Calling Care API: generatePartnerToken");

  const url = `${config.baseUrl}/generatePartnerToken`;
  const getTimestamp = () => Date.now().toString();
  const res = await axios.post(
  url,
  {
    partnerTokenGeneratorInputIO: {
      partnerId: body.partnerId,
      securityKey: body.securityKey,
    },
  },
  {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",

      appId: process.env.CARE_APP_ID,
      signature: generateSignature(),
      timestamp: getTimestamp(),
      applicationCD: "PARTNERAPP",
    },
  }
);

  logger.info("Received tokens from Care API");

  const tokens = res.data?.tokens || [];

  if (!tokens.length) {
    throw new Error("No tokens received from Care");
  }

  setTokens(tokens);

  return res.data;
};

// 2. Create Policy
export const createPolicy = async (payload: any) => {
  const url = `${config.baseUrl}/createPolicy`;

  const token = getToken();

  const combined = token.tokenKey + token.tokenValue;
  const encrypted = encryptToken(combined);

  const res = await axios.post(url, payload, {
    headers: {
      tokenId: encrypted,
      "Content-Type": "application/json",
    },
  });

  return res.data;
};