import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const projectsTable = pgTable(
  "project_hub_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    tags: text("tags").array().notNull().default([]),
    access: text("access").notNull().default("free"),
    status: text("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    isNew: boolean("is_new").notNull().default(true),
    thumbnailUrl: text("thumbnail_url"),
    previewVideoUrl: text("preview_video_url"),
    version: text("version").notNull().default("1.0.0"),
    fileSize: text("file_size"),
    fileAvailable: boolean("file_available").notNull().default(false),
    downloadObjectPath: text("download_object_path"),
    previewVideoObjectPath: text("preview_video_object_path"),
    releaseDate: date("release_date", { mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    screenshots: text("screenshots").array().notNull().default([]),
    supportedDevices: text("supported_devices").array().notNull().default([]),
    requirements: text("requirements").array().notNull().default([]),
    whatsNew: text("whats_new").notNull().default(""),
    changelog: text("changelog").array().notNull().default([]),
    views: integer("views").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),
    favorites: integer("favorites").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_hub_projects_slug_idx").on(table.slug),
    index("project_hub_projects_public_idx").on(
      table.status,
      table.access,
      table.category,
    ),
  ],
);

export const profilesTable = pgTable("project_hub_profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const favoritesTable = pgTable(
  "project_hub_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_hub_favorites_user_project_idx").on(
      table.userId,
      table.projectId,
    ),
    index("project_hub_favorites_user_idx").on(table.userId),
  ],
);

export const downloadsTable = pgTable(
  "project_hub_downloads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("project_hub_downloads_user_idx").on(table.userId)],
);

export const subscriptionsTable = pgTable("project_hub_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  status: text("status").notNull().default("inactive"),
  plan: text("plan"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  provider: text("provider"),
  providerSubscriptionId: text("provider_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const notificationsTable = pgTable(
  "project_hub_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("project_hub_notifications_user_idx").on(table.userId)],
);

export const projectViewsTable = pgTable(
  "project_hub_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("project_hub_views_project_idx").on(table.projectId)],
);

export const adminActionsTable = pgTable(
  "project_hub_admin_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    projectSlug: text("project_slug"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("project_hub_admin_actions_created_idx").on(table.createdAt)],
);

export type ProjectHubProject = typeof projectsTable.$inferSelect;