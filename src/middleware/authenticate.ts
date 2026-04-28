import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { logger } from "../config/logger";

// ─── Extend Express Request to include user ────────────────
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      };
    }
  }
}

// ─── JWT Auth Middleware ───────────────────────────────────
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Access token is required. Use Authorization: Bearer <token>",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token is missing",
      });
      return;
    }

    // Verify token
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          message: "Access token has expired. Please refresh your token.",
        });
        return;
      }

      if (err instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          message: "Invalid access token",
        });
        return;
      }

      res.status(401).json({
        success: false,
        message: "Token verification failed",
      });
      return;
    }

    if (!decoded.userId) {
      res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
      return;
    }

    // Attach user to request
    req.user = { userId: decoded.userId };

    logger.debug("[AUTH MIDDLEWARE] Token verified", {
      userId: decoded.userId,
      url: req.url,
    });

    next();
  } catch (err) {
    logger.error("[AUTH MIDDLEWARE] Unexpected error", { err });
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};