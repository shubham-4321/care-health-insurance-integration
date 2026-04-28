import { Request, Response } from "express";
import { registerSchema, loginSchema, refreshTokenSchema } from "../schema/authSchema";
import { register, login, refreshAccessToken, logout } from "../services/authService";
import { logger } from "../config/logger";

// ─── Register ──────────────────────────────────────────────
export const registerController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await register(parsed.data);
    res.status(201).json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    logger.error("[CONTROLLER] Register failed", { err });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Registration failed",
    });
  }
};

// ─── Login ─────────────────────────────────────────────────
export const loginController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await login(parsed.data);
    res.status(200).json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    logger.error("[CONTROLLER] Login failed", { err });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

// ─── Refresh Token ─────────────────────────────────────────
export const refreshTokenController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const result = await refreshAccessToken(parsed.data.refreshToken);
    res.status(200).json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    logger.error("[CONTROLLER] Refresh token failed", { err });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Token refresh failed",
    });
  }
};

// ─── Logout ────────────────────────────────────────────────
export const logoutController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    const result = await logout(refreshToken);
    res.status(200).json(result);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    logger.error("[CONTROLLER] Logout failed", { err });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Logout failed",
    });
  }
};

// ─── Get Profile ───────────────────────────────────────────
export const getProfileController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // req.user is set by authenticate middleware
    const userId = (req as Request & { user: { userId: string } }).user.userId;

    const { db } = await import("../config/db");
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mobile: true,
        dateOfBirth: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        pincode: true,
        kycStatus: true,
        isMobileVerified: true,
        lastLoginAt: true,
        createdAt: true,
        // Never return password or panNumber
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    logger.error("[CONTROLLER] Get profile failed", { err });
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to get profile",
    });
  }
};