import Joi from "joi";

export const generateTokenSchema = Joi.object({
  partnerId: Joi.string().required().min(1),
  securityKey: Joi.string().required().min(1)
});

export const createPolicySchema = Joi.object({
  partnerId: Joi.string().required(),
  proposalData: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().min(10).max(15).required(),
    age: Joi.number().integer().min(18).max(100).required(),
    sumInsured: Joi.number().positive().required(),
    city: Joi.string().min(2).required(),
    nomineeName: Joi.string().min(2).required(),
    nomineeRelation: Joi.string().min(2).required(),
    transactionId: Joi.string().min(5).required()
  }).required()
});