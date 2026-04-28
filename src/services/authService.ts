import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../config/db";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../middleware/errorHandler";
import type { RegisterInput, LoginInput } from "../schema/authSchema";

// ─── Constants ─────────────────────────────────────────────
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ─── Helpers ───────────────────────────────────────────────
const generateAccessToken = (userId: string): string => {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
};

const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
};

// ─── Encrypt PAN before storing ────────────────────────────
// PAN is sensitive — never store plain text in DB
const encryptPan = (pan: string): string => {
  try {
    const crypto = require("crypto");
    const key = Buffer.from(config.care.aesKey, "utf-8");
    const iv = Buffer.from(config.care.aesIv, "utf-8");
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(pan, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  } catch (err) {
    logger.error("[AUTH] PAN encryption failed", { err });
    throw new AppError("Failed to process PAN number", 500);
  }
};

// ─── Register ──────────────────────────────────────────────
export const register = async (input: RegisterInput) => {
  try {
    // Check email already exists
    const existingEmail = await db.user.findUnique({
      where: { email: input.email },
    });
    if (existingEmail) {
      throw new AppError("Email already registered", 409);
    }

    // Check mobile already exists
    const existingMobile = await db.user.findUnique({
      where: { mobile: input.mobile },
    });
    if (existingMobile) {
      throw new AppError("Mobile number already registered", 409);
    }

    // Check PAN already exists
    const encryptedPan = encryptPan(input.panNumber);
    const existingPan = await db.user.findUnique({
      where: { panNumber: encryptedPan },
    });
    if (existingPan) {
      throw new AppError("PAN number already registered", 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user
    const user = await db.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile,
        dateOfBirth: input.dateOfBirth,
        panNumber: encryptedPan,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mobile: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    logger.info("[AUTH] User registered successfully", {
      userId: user.id,
      email: user.email,
    });

    return {
      success: true,
      message: "Registration successful",
      user,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("[AUTH] Registration failed", { err });
    throw new AppError("Registration failed. Please try again.", 500);
  }
};

// ─── Login ─────────────────────────────────────────────────
export const login = async (input: LoginInput) => {
  try {
    // Find user
    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      // Don't reveal if email exists or not — security
      throw new AppError("Invalid email or password", 401);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError("Account is deactivated. Please contact support.", 403);
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new AppError(
        `Account locked. Try again in ${minutesLeft} minute(s).`,
        423
      );
    }

    // If lock has expired — reset it
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      // Increment failed attempts
      const newFailedAttempts = user.failedLoginAttempts + 1;
      const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCK_DURATION_MS)
            : null,
        },
      });

      if (shouldLock) {
        logger.warn("[AUTH] Account locked after failed attempts", {
          userId: user.id,
          email: user.email,
        });
        throw new AppError(
          "Too many failed attempts. Account locked for 30 minutes.",
          423
        );
      }

      const attemptsLeft = MAX_FAILED_ATTEMPTS - newFailedAttempts;
      throw new AppError(
        `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`,
        401
      );
    }

    // Password correct — reset failed attempts
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token in DB
    const refreshExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    );

    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    logger.info("[AUTH] Login successful", {
      userId: user.id,
      email: user.email,
    });

    return {
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        kycStatus: user.kycStatus,
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("[AUTH] Login failed", { err });
    throw new AppError("Login failed. Please try again.", 500);
  }
};

// ─── Refresh Token ─────────────────────────────────────────
export const refreshAccessToken = async (refreshToken: string) => {
  try {
    // Verify token is valid JWT
    let decoded: { userId: string };
    try {
      decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret
      ) as { userId: string };
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    // Check token exists in DB and not revoked
    const storedToken = await db.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AppError("Refresh token not found", 401);
    }

    if (storedToken.isRevoked) {
      logger.warn("[AUTH] Revoked refresh token used", {
        userId: decoded.userId,
      });
      throw new AppError("Refresh token has been revoked", 401);
    }

    if (storedToken.expiresAt < new Date()) {
      throw new AppError("Refresh token has expired. Please login again.", 401);
    }

    if (!storedToken.user.isActive) {
      throw new AppError("Account is deactivated", 403);
    }

    // Revoke old refresh token — rotation strategy
    // Every refresh gives a new refresh token — old one invalid
    await db.refreshToken.update({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });

    // Generate new tokens
    const newAccessToken = generateAccessToken(storedToken.userId);
    const newRefreshToken = generateRefreshToken(storedToken.userId);

    // Store new refresh token
    await db.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info("[AUTH] Token refreshed successfully", {
      userId: storedToken.userId,
    });

    return {
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error("[AUTH] Token refresh failed", { err });
    throw new AppError("Token refresh failed", 500);
  }
};

// ─── Logout ────────────────────────────────────────────────
export const logout = async (refreshToken: string) => {
  try {
    await db.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { isRevoked: true },
    });

    logger.info("[AUTH] User logged out successfully");

    return {
      success: true,
      message: "Logged out successfully",
    };
  } catch (err) {
    logger.error("[AUTH] Logout failed", { err });
    throw new AppError("Logout failed", 500);
  }
};