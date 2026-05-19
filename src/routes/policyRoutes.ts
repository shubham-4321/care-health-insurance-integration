import { Router } from "express";
import {
  generateTokenController,
  premiumQuoteController,
  createPolicyController,
  paymentInitController,
  proposalStatusController,
  policyPdfController,
} from "../controllers/policyController";
import { authenticate } from "../middleware/authenticate";
import { insuranceLimiter } from "../middleware/rateLimiter";

const router = Router();

// All routes below require a logged-in user.
router.use(authenticate);
router.use(insuranceLimiter);

// POST /api/v1/policy/generateToken — manual Care token refresh
router.post("/generateToken", generateTokenController);

// POST /api/v1/policy/quote — premium quote (no Proposal row persisted)
router.post("/quote", premiumQuoteController);

// POST /api/v1/policy/createPolicy — submit proposal to Care
router.post("/createPolicy", createPolicyController);

// POST /api/v1/policy/payment/init — get encrypted form fields for Care payment
router.post("/payment/init", paymentInitController);

// GET /api/v1/policy/status/:proposalNum — wraps Care's getPolicyStatusV2
router.get("/status/:proposalNum", proposalStatusController);

// GET /api/v1/policy/pdf/:policyNum — wraps Care's getPolicyPDFV2
router.get("/pdf/:policyNum", policyPdfController);

export default router;
