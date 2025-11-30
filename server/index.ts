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

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173", // Dev
  "https://addthislater", // Production
];

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "500kb" }));
// Apply rate limiting to all API routes
app.use("/api", limiter);

// Routes
app.use("/api", convertRouter);

// Health check (no rate limit)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "SchemaBridge API Server",
    status: "ok",
    endpoints: {
      health: "/health",
      convert: "/api/convert",
    },
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
