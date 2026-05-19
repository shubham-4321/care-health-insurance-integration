import { z } from "zod";

// ─── Reusable validators ──────────────────────────────────
const dateDDMMYYYY = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in dd/MM/yyyy format");

const yesNo = z.enum(["YES", "NO"]);

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// ─── Party Address ────────────────────────────────────────
// Max-length constraints from Care's "Max Length / Condition" table.
// FAQ rule: areaCd MUST equal cityCd (enforced via .refine below).
const partyAddressSchema = z
  .object({
    addressTypeCd: z.enum(["PERMANENT", "COMMUNICATION"]),
    addressLine1Lang1: z.string().trim().min(1).max(60),
    addressLine2Lang1: z.string().trim().max(60).optional(),
    cityCd: z.string().trim().min(1).max(30),
    stateCd: z.string().trim().min(1),
    pinCode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
    areaCd: z.string().trim().min(1).max(30),
  })
  .refine((v) => v.areaCd === v.cityCd, {
    message: "areaCd must equal cityCd (per Care FAQ)",
    path: ["areaCd"],
  });

// ─── Party Contact ────────────────────────────────────────
// Master sheet: MOBILE | RESIDENTIAL.
// Max-length table: MOBILE → 11, RESIDENTIAL/OFFICE → 10.
const partyContactSchema = z
  .object({
    contactTypeCd: z.enum(["MOBILE", "RESIDENTIAL"]),
    contactNum: z.string().trim().min(1),
    stdCode: z.string().trim().min(1),
  })
  .superRefine((v, ctx) => {
    const max = v.contactTypeCd === "MOBILE" ? 11 : 10;
    if (v.contactNum.length > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${v.contactTypeCd} contactNum max ${max} chars`,
        path: ["contactNum"],
      });
    }
  });

// ─── Party Email ──────────────────────────────────────────
const partyEmailSchema = z.object({
  emailTypeCd: z.enum(["PERSONAL", "OFFICIAL"]),
  emailAddress: z.string().trim().email().max(55),
});

// ─── Party Identity (PAN / Passport / etc) ────────────────
// Master sheet: identityTypeCd YES, identityNum NO.
// Max-length table: PAN → 10 (exact format), PASSPORT → 8.
const partyIdentitySchema = z
  .object({
    identityTypeCd: z.string().trim().min(1),
    identityNum: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.identityNum) return;
    const type = v.identityTypeCd.toUpperCase();
    if (type === "PAN") {
      if (!PAN_REGEX.test(v.identityNum)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid PAN format. Expected: ABCDE1234F (10 chars)",
          path: ["identityNum"],
        });
      }
    } else if (type === "PASSPORT") {
      if (v.identityNum.length > 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passport number max 8 chars",
          path: ["identityNum"],
        });
      }
    }
  });

// ─── Health Question Answer ───────────────────────────────
// Master sheet IntPartyQuestionDO: questionSetCd, questionCd, response.
const partyQuestionSchema = z.object({
  questionSetCd: z.string().min(1),
  questionCd: z.string().min(1),
  response: yesNo,
});

// ─── Party ────────────────────────────────────────────────
// FAQ rule: predefined tag values must be CAPS. Names auto-uppercased to
// match the sample request style ("WER", "WERTWE"). Addresses left as-is
// (sample has mixed case "Dfg" and Care accepted it).
const partySchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .transform((v) => v.toUpperCase()),
    lastName: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .transform((v) => v.toUpperCase()),
    birthDt: dateDDMMYYYY,
    genderCd: z.enum(["MALE", "FEMALE"]),
    titleCd: z.string().min(1),
    relationCd: z.string().min(1),
    roleCd: z.enum(["PROPOSER", "PRIMARY"]),
    guid: z.string().min(1),

    partyAddressDOList: z.array(partyAddressSchema).min(1),
    partyContactDOList: z.array(partyContactSchema).min(1),
    partyEmailDOList: z.array(partyEmailSchema).min(1),

    partyIdentityDOList: z.array(partyIdentitySchema).optional(),
    partyEmploymentDOList: z.array(z.record(z.unknown())).optional(),
    partyQuestionDOList: z.array(partyQuestionSchema).optional(),
  })
  .passthrough();

// ─── Policy Additional Fields ─────────────────────────────
// Master sheet: field_agree YES, field_tc YES, field_alerts YES,
// field10 YES (Nominee Name), field12 YES (Nominee Relation).
// FAQ rule: field1 is mandatory for all products — non-POS partners pass
// `PI_<PartnerName>`. We accept it as optional here and the service layer
// injects the default before sending to Care.
const policyAdditionalFieldsSchema = z
  .object({
    fieldAgree: yesNo,
    fieldTc: yesNo,
    fieldAlerts: yesNo,
    field1: z.string().optional(),
    field10: z.string().min(1, "Nominee Name is required"),
    field12: z.string().min(1, "Nominee Relation is required"),
  })
  .passthrough();

// ─── Inward (payment) ─────────────────────────────────────
const inwardSchema = z
  .object({
    inwardNum: z.string().optional(),
    inwardAmount: z.string().min(1),
  })
  .passthrough();

// ─── Create Policy Schema ─────────────────────────────────
// Max-length constraints applied to the fields Care enforces:
// proposalNum 13, loanAccNum 16, baseAgentId 8.
export const createPolicySchema = z.object({
  intPolicyDataIO: z.object({
    policy: z
      .object({
        quotationReferenceNum: z.string().optional(),
        proposalNum: z.string().max(13).optional(),
        uwDecisionCd: z.string().optional(),
        policyNum: z.string().optional(),
        premium: z.union([z.string(), z.number()]).optional(),

        businessTypeCd: z.string().min(1),
        baseProductId: z.string().min(1),
        baseAgentId: z.string().min(1).max(8),

        loanTenure: z.string().min(1),
        loanTenureUnitCd: z.enum(["MONTHS", "YEARS"]),
        loanAccNum: z.string().min(1).max(16),
        loanAmount: z.string().min(1),
        loanDisbursalDt: dateDDMMYYYY,

        coverType: z.enum(["INDIVIDUAL", "FAMILYFLOATER"]),
        sumInsured: z.string().min(1),
        term: z.string().min(1),

        addOns: z.string().optional(),
        isPremiumCalculation: yesNo,
        isPaRequired: yesNo.optional(),

        partyDOList: z.array(partySchema).min(1),
        policyAdditionalFieldsDOList: z.array(policyAdditionalFieldsSchema).min(1),

        intInwardDOList: z.array(inwardSchema).optional(),
      })
      .passthrough(),
  }),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

// ─── Runtime rule: PAN required when premium >= 50000 ─────
export const requiresPanForPremium = (premium: number): boolean =>
  premium >= 50000;

export const proposerHasPan = (input: CreatePolicyInput): boolean => {
  const proposer = input.intPolicyDataIO.policy.partyDOList[0];
  return Boolean(
    proposer?.partyIdentityDOList?.some(
      (id) => id.identityTypeCd?.toUpperCase() === "PAN" && id.identityNum
    )
  );
};
