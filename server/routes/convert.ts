import express from "express";
import { convertZodSchema } from "../services/converter.js";

export const convertRouter = express.Router();

convertRouter.post("/convert", async (req, res) => {
  // Check if request timed out
  if (req.timedout) {
    return res.status(408).json({ error: "Request timeout" });
  }

  try {
    const { schemaCode, targetLanguage, zodVersion } = req.body;

    // Validate input
    if (!schemaCode || typeof schemaCode !== "string") {
      return res
        .status(400)
        .json({ error: "schemaCode is required and must be a string" });
    }

    // Stricter validation
    if (schemaCode.length > 100000) {
      // ~100KB max
      return res.status(400).json({
        error: "Schema too large. Maximum 100KB allowed.",
      });
    }

    // Validate line count (reduced from 5000)
    const lineCount = schemaCode.split("\n").length;
    if (lineCount > 2000) {
      return res.status(400).json({
        error: `Schema too large. Maximum 2000 lines, got ${lineCount} lines.`,
      });
    }

    // Check for suspicious patterns (basic protection)
    const suspiciousPatterns = [
      /require\s*\(/,
      /import\s*\(/,
      /child_process/,
      /fs\./,
      /process\./,
      /eval\s*\(/,
      /Function\s*\(/,
      /while\s*\(/,
      /for\s*\(\s*;\s*;\s*\)/,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(schemaCode)) {
        return res.status(400).json({
          error: "Schema contains potentially unsafe code patterns.",
        });
      }
    }

    if (
      !targetLanguage ||
      !["pydantic", "typescript"].includes(targetLanguage)
    ) {
      return res.status(400).json({
        error: 'targetLanguage must be either "pydantic" or "typescript"',
      });
    }

    if (!zodVersion || !["3", "4"].includes(zodVersion)) {
      return res.status(400).json({
        error: 'zodVersion must be either "3" or "4"',
      });
    }

    // Set execution timeout (25 seconds, before the 30s request timeout)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Execution timeout")), 25000);
    });

    // Perform conversion with timeout
    const result = (await Promise.race([
      convertZodSchema(schemaCode, targetLanguage, zodVersion),
      timeoutPromise,
    ])) as { output?: string; error?: string };

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Only log in development
    if (process.env.NODE_ENV !== "production") {
      console.log("Conversion successful");
    }

    res.json({ output: result.output });
  } catch (error) {
    if (error instanceof Error && error.message === "Execution timeout") {
      return res.status(408).json({
        error: "Conversion timed out. Schema may be too complex.",
      });
    }

    console.error("Conversion error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});
