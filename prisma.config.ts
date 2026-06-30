import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct (non-pooled) URL for migrate; falls back to DATABASE_URL if unset
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
});
