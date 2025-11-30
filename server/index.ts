import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import timeout from "connect-timeout";
import { convertRouter } from "./routes/convert.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes per IP
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(timeout("30s")); // Kill requests after 30 seconds

const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:5173", // Dev
    "https://sbpg.vercel.app", // Production (default)
  ];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin/no-origin (e.g., curl) and explicit allowlist matches
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

// Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "500kb" }));
// Apply rate limiting to all API routes
app.use("/api", limiter);

// Routes
app.use("/api", convertRouter);

// Health check (no rate limit)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Root route
app.get("/", (_req, res) => {
  res.json({
    message: "SchemaBridge API Server",
    status: "ok",
    endpoints: {
      health: "/health",
      convert: "/api/convert",
    },
  });
});

// In serverless (Vercel) we export the app; locally we still listen
if (!process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  });
}

export default app;
