import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAccountResponse,
  GetSubscriptionResponse,
  ListDownloadsResponse,
  ListFavoritesResponse,
  ListNotificationsResponse,
  RemoveFavoriteParams,
  RemoveFavoriteResponse,
  SaveFavoriteParams,
  SaveFavoriteResponse,
} from "@workspace/api-zod";
import {
  db,
  downloadsTable,
  favoritesTable,
  notificationsTable,
  profilesTable,
  projectsTable,
  subscriptionsTable,
} from "@workspace/db";
import {
  clerkProfile,
  hasPremiumAccess,
  serializeProject,
} from "../lib/project-hub-projects";
import {
  getRequestUserId,
  isOwnerUser,
  requireUser,
} from "../lib/project-hub-auth";

const router: IRouter = Router();
router.use("/me", requireUser);

router.get("/me", async (_req, res): Promise<void> => {
  const userId = getRequestUserId(res);
  const profile = await clerkProfile(userId);
  await db
    .insert(profilesTable)
    .values({ userId, ...profile })
    .onConflictDoUpdate({
      target: profilesTable.userId,
      set: { ...profile, updatedAt: new Date() },
    });

  const [favoriteRows, downloadRows] = await Promise.all([
    db
      .select({ count: favoritesTable.id })
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, userId)),
    db
      .select({ count: downloadsTable.id })
      .from(downloadsTable)
      .where(eq(downloadsTable.userId, userId)),
  ]);
  const isAdmin = await isOwnerUser(userId);
  res.json(
    GetAccountResponse.parse({
      userId,
      displayName: profile.displayName,
      email: profile.email,
      isAdmin,
      favoriteCount: favoriteRows.length,
      downloadCount: downloadRows.length,
    }),
  );
});

router.get("/me/favorites", async (_req, res): Promise<void> => {
  const userId = getRequestUserId(res);
  const rows = await db
    .select({ project: projectsTable })
    .from(favoritesTable)
    .innerJoin(projectsTable, eq(favoritesTable.projectId, projectsTable.id))
    .where(
      and(
        eq(favoritesTable.userId, userId),
        eq(projectsTable.status, "published"),
      ),
    )
    .orderBy(desc(favoritesTable.createdAt));
  const response = await Promise.all(
    rows.map(({ project }) => serializeProject(project)),
  );
  res.json(ListFavoritesResponse.parse(response));
});

router.put("/me/favorites/:slug", async (req, res): Promise<void> => {
  const params = SaveFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project slug" });
    return;
  }
  const userId = getRequestUserId(res);
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.slug, params.data.slug),
        eq(projectsTable.status, "published"),
      ),
    )
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [inserted] = await db
    .insert(favoritesTable)
    .values({ userId, projectId: project.id })
    .onConflictDoNothing()
    .returning({ id: favoritesTable.id });
  if (inserted) {
    await db
      .update(projectsTable)
      .set({ favorites: sql`${projectsTable.favorites} + 1` })
      .where(eq(projectsTable.id, project.id));
  }
  res.json(SaveFavoriteResponse.parse({ success: true, message: "Saved" }));
});

router.delete("/me/favorites/:slug", async (req, res): Promise<void> => {
  const params = RemoveFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project slug" });
    return;
  }
  const userId = getRequestUserId(res);
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.slug, params.data.slug))
    .limit(1);
  if (project) {
    const [removed] = await db
      .delete(favoritesTable)
      .where(
        and(
          eq(favoritesTable.userId, userId),
          eq(favoritesTable.projectId, project.id),
        ),
      )
      .returning({ id: favoritesTable.id });
    if (removed) {
      await db
        .update(projectsTable)
        .set({
          favorites: sql`GREATEST(${projectsTable.favorites} - 1, 0)`,
        })
        .where(eq(projectsTable.id, project.id));
    }
  }
  res.json(RemoveFavoriteResponse.parse({ success: true, message: "Removed" }));
});

router.get("/me/downloads", async (_req, res): Promise<void> => {
  const userId = getRequestUserId(res);
  const rows = await db
    .select({
      id: downloadsTable.id,
      projectSlug: projectsTable.slug,
      projectTitle: projectsTable.title,
      createdAt: downloadsTable.createdAt,
    })
    .from(downloadsTable)
    .innerJoin(projectsTable, eq(downloadsTable.projectId, projectsTable.id))
    .where(eq(downloadsTable.userId, userId))
    .orderBy(desc(downloadsTable.createdAt));
  res.json(
    ListDownloadsResponse.parse(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.get("/me/notifications", async (_req, res): Promise<void> => {
  const userId = getRequestUserId(res);
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt));
  res.json(
    ListNotificationsResponse.parse(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.get("/me/subscription", async (_req, res): Promise<void> => {
  const userId = getRequestUserId(res);
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);
  const premiumEnabled = await hasPremiumAccess(userId);
  let status:
    | "inactive"
    | "active"
    | "cancelled"
    | "past_due" = subscription?.status === "active" ||
    subscription?.status === "cancelled" ||
    subscription?.status === "past_due"
      ? subscription.status
      : "inactive";
  if (
    subscription?.status === "active" &&
    subscription.expiresAt &&
    subscription.expiresAt.getTime() <= Date.now()
  ) {
    status = "past_due";
  }
  res.json(
    GetSubscriptionResponse.parse({
      status,
      plan: subscription?.plan ?? null,
      expiresAt: subscription?.expiresAt?.toISOString() ?? null,
      premiumEnabled,
    }),
  );
});

export default router;