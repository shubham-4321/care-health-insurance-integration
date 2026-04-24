import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";

export const validate =
  (
    schema: ObjectSchema,
    source: "body" | "headers" | "combined" = "body"
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    let data: any;

    // -----------------------
    // choose validation source
    // -----------------------
    if (source === "body") {
      data = req.body;
    } else if (source === "headers") {
      data = req.headers;
    } else {
      data = {
        ...req.body,
        ...req.headers,
      };
    }

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation Error",
        errors: error.details.map((e) => e.message),
      });
    }

    req.body = value;

    next();
  };