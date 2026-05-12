import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
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
  shareLinkId: text("share_link_id"),
  uploaderLabel: text("uploader_label"),
  shortUrl: text("short_url"),
});

export const allowedUsers = pgTable("allowed_users", {
  email: text("email").primaryKey(),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const shareLinks = pgTable("share_links", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  label: text("label"),
  maxFiles: integer("max_files"),
  maxTotalBytes: bigint("max_total_bytes", { mode: "number" }),
  allowedExtensions: jsonb("allowed_extensions")
    .$type<string[]>()
    .notNull()
    .default([]),
  status: text("status").notNull().default("open"),
  shortUrl: text("short_url"),
  expiresAt: timestamp("expires_at"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
