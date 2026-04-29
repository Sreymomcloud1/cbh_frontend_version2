import "module-alias/register";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env, isDev } from "@/config/env";
import apiRoutes from "@/routes/index";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import savedBusinessesRouter from "@/routes/savedBusiness";

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
const allowedOriginMatchers = allowedOrigins
  .filter(Boolean)
  .map((origin) => {
    if (origin.includes("*")) {
      const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`);
    }
    return origin;
  });

function isAllowedOrigin(origin: string): boolean {
  if (allowedOriginMatchers.some((entry) => (typeof entry === "string" ? entry === origin : entry.test(origin)))) {
    return true;
  }
  if (env.ALLOW_TRYCLOUDFLARE_ORIGINS && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin)) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. Postman, server-to-server)
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Rate limiting ──────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: "Too many requests. Please try again later.", code: "RATE_LIMIT" },
    },
  })
);

// ── Body parsing + compression ─────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(compression());

// ── HTTP request logging ───────────────────────────────────────────────────
app.use(morgan(isDev ? "dev" : "combined"));

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/api/v1", apiRoutes);


// ✅ ADD THIS (this is the fix)
app.use("/api/v1/saved-businesses", savedBusinessesRouter);

// ── 404 + global error handler ────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n✅ Sourcely API running`);
  console.log(`   → http://localhost:${env.PORT}/api/v1`);
  console.log(`   → ENV: ${env.NODE_ENV}\n`);
});

//app.use("/api/v1/saved-businesses", savedBusinessRoutes);
export default app;
