import { Request, Response } from "express";
import { logger } from "../config/logger";
import { lookupPincode } from "../services/pincode";
import {
  SUM_INSURED_PLANS,
  COVER_TYPES,
  RELATIONS,
  TITLES,
  GENDERS,
  LOAN_TENURE_UNITS,
  ADD_ONS,
  HEALTH_QUESTIONS,
  ROLES,
  CI_20_LIST,
  PLAN_OPTIONS,
  COMPLIANCE,
  ADDRESS_TYPES,
  CONTACT_TYPES,
  EMAIL_TYPES,
  IDENTITY_TYPES,
  BUSINESS_TYPES,
} from "../services/masterData";

// ─── GET /api/v1/master ───────────────────────────────────
// One-shot bundle for the frontend to render all dropdowns/options.
export const allMasterDataController = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    success: true,
    data: {
      sumInsuredPlans: SUM_INSURED_PLANS,
      coverTypes: COVER_TYPES,
      relations: RELATIONS,
      titles: TITLES,
      genders: GENDERS,
      loanTenureUnits: LOAN_TENURE_UNITS,
      addOns: ADD_ONS,
      healthQuestions: HEALTH_QUESTIONS,
      roles: ROLES,
      businessTypes: BUSINESS_TYPES,
      addressTypes: ADDRESS_TYPES,
      contactTypes: CONTACT_TYPES,
      emailTypes: EMAIL_TYPES,
      identityTypes: IDENTITY_TYPES,
      planOptions: PLAN_OPTIONS,
      criticalIllnessList: CI_20_LIST,
      compliance: COMPLIANCE,
    },
  });
};

// ─── GET /api/v1/master/pincode/:pincode ──────────────────
// Returns city/state for a given pincode so the frontend can auto-fill.
export const pincodeLookupController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const pincode = req.params.pincode?.trim();
    if (!pincode) {
      res.status(400).json({ success: false, message: "pincode is required" });
      return;
    }

    const record = await lookupPincode(pincode);
    if (!record) {
      res.status(404).json({
        success: false,
        message: "Pincode not found",
      });
      return;
    }

    res.status(200).json({ success: true, data: record });
  } catch (err) {
    logger.error("[CONTROLLER] pincodeLookup failed", { err });
    res.status(500).json({
      success: false,
      message: "Failed to look up pincode",
    });
  }
};
