import { Request, Response, NextFunction, Router } from "express";
import { generatePartnerToken, createPolicy } from "../services/careApi";
import { validate } from "../middleware/validate";
import { generateTokenSchema, createPolicySchema } from "../schema/policySchema";
import logger from "../utils/logger";

class PolicyController {
  router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post("/generateToken", validate(generateTokenSchema,"combined"), this.generateToken);
    this.router.post("/createPolicy", validate(createPolicySchema), this.createPolicy);
  }

  private generateToken = async (req: Request, res: Response) => {
    try {
      const data = await generatePartnerToken(req.body, req.headers);
      return res.status(200).json(data);
    } catch (error: any) {
      logger.error({
        message: "generateToken failed",
        error: error.response?.data || error.message,
      });
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message,
      });
    }
  };

  private createPolicy = async (req: Request, res: Response) => {
    try {
      const data = await createPolicy(req.body, req.headers);
      return res.status(200).json(data);
    } catch (error: any) {
      logger.error({
        message: "createPolicy failed",
        error: error.response?.data || error.message,
      });
      console.log("ERROR RESPONSE:", JSON.stringify(error?.response?.data, null, 2));
      return res.status(500).json({
        success: false,
        error: error.response?.data || error.message,
      });
    }
  };
}

export default new PolicyController();