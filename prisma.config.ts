import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // migrations use the direct (non-pooled) connection; runtime uses pooled
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
    adapter: () => {
      const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
      return new PrismaPg(pool);
    },
  },
});
