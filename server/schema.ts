import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
} from "drizzle-orm/pg-core";

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type"),
  size: bigint("size", { mode: "number" }).notNull(),
  r2Key: text("r2_key").notNull(),
  passwordHash: text("password_hash"),
  salt: text("salt"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  accessCount: integer("access_count").default(0).notNull(),
});

export const allowedUsers = pgTable("allowed_users", {
  email: text("email").primaryKey(),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
