import { Router } from "express";
import {
  registerController,
  loginController,
  refreshTokenController,
  logoutController,
  getProfileController,
} from "../controllers/authController";
import { authenticate } from "../middleware/authenticate";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

// ─── Public Routes ─────────────────────────────────────────
// No JWT required — these create/give the JWT

// POST /api/v1/auth/register
router.post("/register", authLimiter, registerController);

// POST /api/v1/auth/login
router.post("/login", authLimiter, loginController);

// POST /api/v1/auth/refresh
router.post("/refresh", refreshTokenController);

// POST /api/v1/auth/logout
router.post("/logout", logoutController);

// ─── Protected Routes ──────────────────────────────────────
// JWT required — authenticate middleware runs first

// GET /api/v1/auth/profile
router.get("/profile", authenticate, getProfileController);

export default router;