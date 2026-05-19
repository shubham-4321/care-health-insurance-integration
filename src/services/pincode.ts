import axios from "axios";
import { logger } from "../config/logger";

// ─── Pincode → city/state lookup ──────────────────────────
// Doc page 7 specifies that City auto-fills and State auto-fills from
// the pincode. Long-term this should come from Care's master sheet or
// a paid pincode service. For now we fall back to India Post's free
// public API (postalpincode.in) with a small in-memory cache.

type PincodeRecord = {
  pincode: string;
  city: string;
  state: string;
  areaCd?: string;
};

const cache = new Map<string, PincodeRecord>();

export const lookupPincode = async (
  pincode: string
): Promise<PincodeRecord | null> => {
  if (!/^\d{6}$/.test(pincode)) return null;

  const cached = cache.get(pincode);
  if (cached) return cached;

  try {
    const res = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
      timeout: 5000,
    });
    const entry = res.data?.[0];
    const office = entry?.PostOffice?.[0];

    if (entry?.Status !== "Success" || !office) {
      return null;
    }

    const record: PincodeRecord = {
      pincode,
      city: office.District?.toUpperCase() ?? "",
      state: office.State?.toUpperCase() ?? "",
    };

    cache.set(pincode, record);
    return record;
  } catch (err) {
    logger.error("[PINCODE] Lookup failed", { pincode, err });
    return null;
  }
};
