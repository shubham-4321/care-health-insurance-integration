import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";

// ─── Custom App Error class ────────────────────────────────
// Use this anywhere in your code to throw a controlled error
// with a specific HTTP status code and message
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Global Error Handler ──────────────────────────────────
// Must have 4 parameters for Express to treat it as error middleware
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  try {
    // ── Log the real error internally ──────────────────────
    logger.error("[ERROR HANDLER] Unhandled error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    // ── Zod validation error ───────────────────────────────
    // Happens when request body fails schema validation
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    // ── Our own AppError ───────────────────────────────────
    // Controlled errors we throw deliberately
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
      return;
    }

    // ── Axios errors (Care Health API failures) ────────────
    if (
      typeof err === "object" &&
      err !== null &&
      "isAxiosError" in err &&
      (err as { isAxiosError: boolean }).isAxiosError
    ) {
      res.status(502).json({
        success: false,
        message: "External service error. Please try again.",
      });
      return;
    }

    // ── Prisma errors ──────────────────────────────────────
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err
    ) {
      const prismaErr = err as { code: string };

      // Unique constraint violation
      if (prismaErr.code === "P2002") {
        res.status(409).json({
          success: false,
          message: "A record with this data already exists",
        });
        return;
      }

      // Record not found
      if (prismaErr.code === "P2025") {
        res.status(404).json({
          success: false,
          message: "Record not found",
        });
        return;
      }
    }

    // ── Unknown error — never expose internals ─────────────
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });

  } catch (handlerErr) {
    // If even the error handler crashes — last resort
    logger.error("[ERROR HANDLER] Error handler itself failed", {
      handlerErr,
    });
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};