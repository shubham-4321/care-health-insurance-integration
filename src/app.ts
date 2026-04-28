import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/env";
import { logger } from "./config/logger";
import { generalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes"

const app = express();

// ─── 1. Security Headers ───────────────────────────────────
// Helmet sets ~15 security-related HTTP headers automatically
// Prevents clickjacking, MIME sniffing, XSS etc
app.use(helmet());

// ─── 2. CORS ──────────────────────────────────────────────
// Controls which domains can call your API
// In prod — only your frontend domain
// In dev — localhost allowed
app.use(
  cors({
    origin: (origin, callback) => {
      try {
        // Allow requests with no origin (Postman, mobile apps)
        if (!origin) return callback(null, true);

        if (config.security.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        logger.warn("[CORS] Blocked request from unauthorized origin", {
          origin,
        });

        return callback(new Error("Not allowed by CORS"));
      } catch (err) {
        logger.error("[CORS] Origin check failed", { err });
        return callback(new Error("CORS check failed"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ─── 3. Body Parsers ───────────────────────────────────────
// Parse JSON bodies — limit 10kb prevents large payload attacks
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── 4. General Rate Limiter ───────────────────────────────
// Applied to all routes before they're registered
app.use(generalLimiter);

// ─── 5. Request Logger ────────────────────────────────────
// Logs every incoming request — method, url, ip, timestamp
app.use((req: Request, res: Response, next: express.NextFunction) => {
  try { 
    const start = Date.now();

    res.on("finish", () => {
      try {
        const duration = Date.now() - start;
        logger.info("[REQUEST]", {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
        });
      } catch {
        // Never crash on logging
      }
    });

    next();
  } catch (err) {
    logger.error("[REQUEST LOGGER] Failed", { err });
    next();
  }
});

// ─── 6. Health Check ──────────────────────────────────────
// Simple endpoint to verify server is running
// Used by deployment platforms to check if app is alive
app.get("/health", (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      message: "Server is running",
      environment: config.app.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[HEALTH] Health check failed", { err });
    res.status(500).json({ success: false, message: "Health check failed" });
  }
});

// ─── 7. Routes ────────────────────────────────────────────
// Will be added here in next steps
app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/insurance", insuranceRoutes);

// ─── 8. 404 Handler ───────────────────────────────────────
// Any route not matched above returns clean 404
app.use((req: Request, res: Response) => {
  try {
    logger.warn("[404] Route not found", {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    res.status(404).json({
      success: false,
      message: `Route ${req.method} ${req.url} not found`,
    });
  } catch (err) {
    logger.error("[404] Handler failed", { err });
    res.status(404).json({ success: false, message: "Route not found" });
  }
});

// ─── 9. Global Error Handler ──────────────────────────────
// MUST be last — after all routes
// Catches everything that calls next(err)
app.use(errorHandler);

export default app;