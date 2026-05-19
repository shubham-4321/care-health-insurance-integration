// ─── Care master data ─────────────────────────────────────
// Values confirmed against Care's "Master data - Group Care" PDF (the
// columns "Master Values" + "Static(YES/NO)").
//
// What's MISSING from the sheet you shared (referenced as "Refer ... sheet"
// but not included):
//   • Sum Insured codes  → sample request uses `"001"` (a code, NOT the
//     rupee amount). Need the full code → amount mapping.
//   • Relation codes      → sample uses `"SELF"`; need the full list.
//   • Question Master     → questionSetCd / questionCd values and which
//     subset is mandatory.
//   • Pincode / City / State / Area codes → master sheet says "extract
//     from db(PINCODECITYSTATEMAP & PINCODEAREA)". Need Care's dataset.
//   • Add-on codes catalogue → sample sends "ACCIC8009,8485" but the
//     enumerated list isn't in the file.
//
// Until those arrive, the SUM_INSURED_PLANS / HEALTH_QUESTIONS / ADD_ONS
// lists below are placeholders so the frontend doesn't break — replace
// them with the official values when Prashant shares the sheet.

// TODO: replace with the Sum Insured sheet codes (sample uses "001").
export const SUM_INSURED_PLANS = [
  { code: "001", label: "Plan 001 (placeholder)" },
];

// Cover types — confirmed against master sheet "INDIVIDUAL,FAMILYFLOATER".
export const COVER_TYPES = [
  { code: "INDIVIDUAL", label: "Individual" },
  { code: "FAMILYFLOATER", label: "Family Floater" },
];

// TODO: replace with the Relation of proposer sheet codes.
// Sample request uses "SELF" — others likely include SPOUSE, SON, DAUGHTER,
// FATHER, MOTHER but the official codes aren't in the file we have.
export const RELATIONS = [
  { code: "SELF", label: "Self" },
];

// Titles — master sheet allows only MR, MS.
export const TITLES = [
  { code: "MR", label: "Mr.", gender: "MALE" },
  { code: "MS", label: "Ms.", gender: "FEMALE" },
];

// Genders — master sheet "MALE,FEMALE".
export const GENDERS = [
  { code: "MALE", label: "Male" },
  { code: "FEMALE", label: "Female" },
];

// Loan tenure unit — master sheet shows "MONTHS(Static)". Per sample,
// also YEARS is accepted in the createPolicy payload.
export const LOAN_TENURE_UNITS = [
  { code: "MONTHS", label: "Months" },
  { code: "YEARS", label: "Years" },
];

// TODO: replace with full add-on catalogue from Care.
// Sample uses "ACCIC8009,8485" (comma-separated codes).
export const ADD_ONS = [
  { code: "ACCIC8009", label: "Add-on ACCIC8009 (placeholder)" },
  { code: "8485", label: "Add-on 8485 (placeholder)" },
];

// TODO: replace with the Question Master sheet rows.
// Per master sheet IntPartyQuestionDO each entry needs:
//   { questionSetCd, questionCd, response: "YES" | "NO" }
export const HEALTH_QUESTIONS: Array<{
  questionSetCd: string;
  questionCd: string;
  text: string;
}> = [];

// Roles — master sheet "PROPOSER,PRIMARY".
export const ROLES = [
  { code: "PROPOSER", label: "Proposer" },
  { code: "PRIMARY", label: "Insured" },
];

// Business types — master sheet shows "NEWBUSINESS" as the static value.
export const BUSINESS_TYPES = [
  { code: "NEWBUSINESS", label: "New Business" },
];

// Address types — master sheet "PERMANENT, COMMUNICATION".
export const ADDRESS_TYPES = [
  { code: "PERMANENT", label: "Permanent" },
  { code: "COMMUNICATION", label: "Communication" },
];

// Contact types — master sheet "MOBILE, RESIDENTIAL".
export const CONTACT_TYPES = [
  { code: "MOBILE", label: "Mobile" },
  { code: "RESIDENTIAL", label: "Residential" },
];

// Email types — master sheet "PERSONAL, OFFICIAL".
export const EMAIL_TYPES = [
  { code: "PERSONAL", label: "Personal" },
  { code: "OFFICIAL", label: "Official" },
];

// Identity types — master sheet "PAN, PASSPORT".
export const IDENTITY_TYPES = [
  { code: "PAN", label: "PAN" },
  { code: "PASSPORT", label: "Passport" },
];

// ─── 20 Critical Illness conditions ───────────────────────
// Confirmed list from the Urban Money policy PDF (Care policy 49871313,
// pages 16–17). Covered under the "20 CI" benefit in Plan Options 1, 2,
// 4, 5, 7.
export const CI_20_LIST = [
  "Cancer Of Specified Severity",
  "Myocardial Infarction",
  "Open Chest CABG",
  "Stroke Resulting in Permanent Symptoms",
  "Open Heart Replacement Or Repair Of Heart Valves",
  "Multiple Sclerosis with Persisting Symptoms",
  "Major Organ /Bone Marrow Transplant",
  "Permanent Paralysis Of Limbs",
  "Kidney Failure Requiring Regular Dialysis",
  "Benign Brain Tumour",
  "Blindness",
  "Motor Neurone Disease with Permanent Symptoms",
  "End Stage Lung Failure",
  "Third Degree Burns",
  "Coma of Specified Severity",
  "Parkinson's Disease",
  "Alzheimer's Disease",
  "End Stage Liver Failure",
  "Bacterial Meningitis",
  "Aplastic Anaemia",
];

// ─── Plan options for Urban Money (Group Care 360) ────────
// From policy PDF 49871313 (pages 1–16). Each option mixes different
// covers and uses a different per-lakh rate × age band × tenure table.
//
// TODO: fill in `baseProductId` per option — sample request uses
// "80003296" but the doc lists 7 options. Need Care to confirm which
// productId corresponds to each option for Urban Money's UAT.
export const PLAN_OPTIONS = [
  {
    code: "OPTION_1",
    label: "Option 1 — PA + CI 20 + Acc Hosp + Loss of Employment",
    covers: ["PA", "CI_20", "ACCIDENTAL_HOSPITALIZATION", "LOSS_OF_EMPLOYMENT"],
    entryAgeMin: 18,
    entryAgeMax: 65,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null as string | null,
  },
  {
    code: "OPTION_2",
    label: "Option 2 — CI 20 + Cancer Indemnity",
    covers: ["CI_20", "CANCER_INDEMNITY"],
    entryAgeMin: 18,
    entryAgeMax: 65,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null,
  },
  {
    code: "OPTION_3",
    label: "Option 3 — PA + Cancer Indemnity",
    covers: ["PA", "CANCER_INDEMNITY"],
    entryAgeMin: 18,
    entryAgeMax: 65,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null,
  },
  {
    code: "OPTION_4",
    label: "Option 4 — PA + CI 20 + Cancer Indemnity",
    covers: ["PA", "CI_20", "CANCER_INDEMNITY"],
    entryAgeMin: 18,
    entryAgeMax: 65,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null,
  },
  {
    code: "OPTION_5",
    label: "Option 5 — CI 20 + Cancer Indemnity (Urban Money rates)",
    covers: ["CI_20", "CANCER_INDEMNITY"],
    entryAgeMin: 18,
    entryAgeMax: 65,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null,
  },
  {
    code: "OPTION_6",
    label: "Option 6 — PA + Vector Borne Disease + Loss of Employment + Acc Hosp",
    covers: [
      "PA",
      "VECTOR_BORNE_DISEASE",
      "LOSS_OF_EMPLOYMENT",
      "ACCIDENTAL_HOSPITALIZATION",
    ],
    entryAgeMin: 18,
    entryAgeMax: 70,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null,
  },
  {
    code: "OPTION_7",
    label:
      "Option 7 — PA + CI 20 + Cancer Indemnity + Convalescence + Acc Hosp",
    covers: [
      "PA",
      "CI_20",
      "CANCER_INDEMNITY",
      "CONVALESCENCE",
      "ACCIDENTAL_HOSPITALIZATION",
    ],
    entryAgeMin: 18,
    entryAgeMax: 65,
    tenures: [1, 2, 3, 4, 5],
    baseProductId: null,
  },
];

// ─── Compliance metadata (from issued policy 49871313) ────
export const COMPLIANCE = {
  insurer: "Care Health Insurance Limited",
  irdaiRegistrationNumber: "148",
  uins: {
    groupCare360: "CHIHLGP25038V022425",
    groupCare360Plus: "CHIHLGA24170V012324",
  },
  tpa: {
    name: "Care Health Insurance Limited",
    address:
      "Vipul Tech Square, Tower C, 3rd Floor, Golf Course Road, Sector-43, Gurugram-122009 (Haryana)",
    phone: "1800-102-4488",
    email: "claims@careinsurance.com",
    website: "www.careinsurance.com",
  },
};

