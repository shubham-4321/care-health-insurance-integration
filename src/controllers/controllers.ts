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
    this.router.post("/generateToken", validate(generateTokenSchema), this.generateToken);
    this.router.post("/createPolicy", validate(createPolicySchema), this.createPolicy);
  }

  private generateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await generatePartnerToken(req.body);
      return res.send(data);
    } catch (error: any) {
      logger.error({
        message: "Error in generateToken",
        error: error.response?.data || error.message
      });
      return res.status(500).send({
        error: error.response?.data || error.message,
      });
    }
  };

  private createPolicy = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            return res.status(400).send({ error: "Payload missing" });
        }
      const data = await createPolicy(req.body);
      return res.send(data);
    } catch (error: any) {
      return res.status(500).send({
        error: error.response?.data || error.message,
      });
    }
  };
}

export default new PolicyController();