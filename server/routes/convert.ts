import express from "express";
import { convertZodSchema } from "../services/converter.js";

export const convertRouter = express.Router();

convertRouter.post("/convert", async (req, res) => {
  try {
    const { schemaCode, targetLanguage, zodVersion } = req.body;

    // Validate input
    if (!schemaCode || typeof schemaCode !== "string") {
      return res
        .status(400)
        .json({ error: "schemaCode is required and must be a string" });
    }

    // Validate line count (max 5000 lines)
    const lineCount = schemaCode.split('\n').length;
    if (lineCount > 5000) {
      return res
        .status(400)
        .json({ error: `Schema too large. Maximum 5000 lines, got ${lineCount} lines.` });
    }

    if (
      !targetLanguage ||
      !["pydantic", "typescript"].includes(targetLanguage)
    ) {
      return res
        .status(400)
        .json({
          error: 'targetLanguage must be either "pydantic" or "typescript"',
        });
    }

    if (!zodVersion || !["3", "4"].includes(zodVersion)) {
      return res
        .status(400)
        .json({
          error: 'zodVersion must be either "3" or "4"',
        });
    }

    // Perform conversion
    const result = await convertZodSchema(
      schemaCode,
      targetLanguage,
      zodVersion
    );

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Only log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log("Conversion successful");
    }

    res.json({ output: result.output });
  } catch (error) {
    console.error("Conversion error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});
