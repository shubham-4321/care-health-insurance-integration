import Joi from "joi";

export const generateTokenSchema = Joi.object({
  // ---------------- BODY ----------------
  partnerTokenGeneratorInputIO: Joi.object({
    partnerId: Joi.string().required(),
    securityKey: Joi.string().required(),
  }).required(),

  // ---------------- HEADERS ----------------
  appid: Joi.string().required(),
  signature: Joi.string().required(),
  timestamp: Joi.string().required(),
  applicationcd: Joi.string().required(),
}).unknown(true);

export const createPolicySchema = Joi.object({
  intPolicyDataIO: Joi.object({
    policy: Joi.object({
      businessTypeCd: Joi.string().required(),
      baseProductId: Joi.string().required(),
      baseAgentId: Joi.string().required(),

      loanTenure: Joi.string().required(),
      loanTenureUnitCd: Joi.string().valid("MONTHS", "YEARS").required(),
      loanAccNum: Joi.string().required(),
      loanAmount: Joi.string().required(),
      loanDisbursalDt: Joi.string().required(),

      coverType: Joi.string().valid("INDIVIDUAL", "FAMILY").required(),

      sumInsured: Joi.string().required(),
      term: Joi.string().required(),

      addOns: Joi.string().optional(),
      isPremiumCalculation: Joi.string().valid("YES", "NO").required(),

      // ---------------- PARTY LIST ----------------
      partyDOList: Joi.array()
        .items(
          Joi.object({
            firstName: Joi.string().required(),
            lastName: Joi.string().required(),
            birthDt: Joi.string().required(),

            genderCd: Joi.string().valid("MALE", "FEMALE").required(),
            titleCd: Joi.string().required(),

            relationCd: Joi.string().required(),
            roleCd: Joi.string().required(),

            guid: Joi.string().required(),

            // -------- ADDRESS --------
            partyAddressDOList: Joi.array()
              .items(
                Joi.object({
                  addressTypeCd: Joi.string()
                    .valid("PERMANENT", "COMMUNICATION")
                    .required(),
                  addressLine1Lang1: Joi.string().required(),
                  addressLine2Lang1: Joi.string().required(),
                  cityCd: Joi.string().required(),
                  stateCd: Joi.string().required(),
                  pinCode: Joi.string().length(6).required(),
                  areaCd: Joi.string().required(),
                })
              )
              .min(1)
              .required(),

            // -------- CONTACT --------
            partyContactDOList: Joi.array()
              .items(
                Joi.object({
                  contactTypeCd: Joi.string().valid("MOBILE").required(),
                  contactNum: Joi.string().required(),
                  stdCode: Joi.string().required(),
                })
              )
              .required(),

            // -------- EMAIL --------
            partyEmailDOList: Joi.array()
              .items(
                Joi.object({
                  emailTypeCd: Joi.string().valid("PERSONAL").required(),
                  emailAddress: Joi.string().email().required(),
                })
              )
              .required(),

            partyIdentityDOList: Joi.array().items(Joi.object()).optional(),
            partyEmploymentDOList: Joi.array().items(Joi.object()).optional(),
            partyQuestionDOList: Joi.array().items(Joi.object()).optional(),
          })
        )
        .min(1)
        .required(),

      // ---------------- ADDITIONAL FIELDS ----------------
      policyAdditionalFieldsDOList: Joi.array()
        .items(
          Joi.object({
            fieldAgree: Joi.string().valid("YES", "NO").required(),
            fieldTc: Joi.string().valid("YES", "NO").required(),
            fieldAlerts: Joi.string().valid("YES", "NO").required(),

            field1: Joi.string().optional(),
            field10: Joi.string().optional(),
            field12: Joi.string().optional(),
          })
        )
        .required(),
    }).required(),
  }).required(),
});