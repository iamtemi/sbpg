// api/index.ts
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import timeout from "connect-timeout";
import { convertRouter } from "../server/routes/convert.js"; // adjust path if needed
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Rate limiter (apply to all API routes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(timeout("30s"));

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "https://sbpg.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "500kb" }));

// Apply rate limiting only to /api/*
app.use("/api", limiter);
app.use("/api", convertRouter);

// Public routes (no rate limit)
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api", (_req, res) =>
  res.json({
    message: "SchemaBridge API Server",
    status: "ok",
    endpoints: { health: "/health", convert: "/api/convert" },
  })
);

// Serve React frontend
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));

// SPA fallback – MUST be last
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
