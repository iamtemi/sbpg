export const DEFAULT_SCHEMA_V3 = `import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
  role: z.enum(["admin", "user", "guest"]),
  createdAt: z.date(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.any()).optional(),
});
`;

export const DEFAULT_SCHEMA_V4 = `import { z } from "zod";

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.int().positive().optional(),
  role: z.enum(["admin", "user", "guest"]),
  createdAt: z.date(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.any()).optional(),
});
`;

// Helper to get the default schema for a specific version
export function getDefaultSchema(version: "3" | "4"): string {
  return version === "3" ? DEFAULT_SCHEMA_V3 : DEFAULT_SCHEMA_V4;
}

// Helper to check if current code is a default schema
export function isDefaultSchema(code: string): boolean {
  return code === DEFAULT_SCHEMA_V3 || code === DEFAULT_SCHEMA_V4;
}
