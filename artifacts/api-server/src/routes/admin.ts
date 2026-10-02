import { and, count, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AdminOverview,
  ArchiveProjectParams,
  ArchiveProjectResponse,
  CreateProjectBody,
  CreateProjectResponse,
  GetAdminOverviewResponse,
  ListAdminProjectsResponse,
  SetProjectPublicationBody,
  SetProjectPublicationParams,
  SetProjectPublicationResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import {
  adminActionsTable,
  authUsersTable,
  db,
  projectsTable,
  subscriptionsTable,
} from "@workspace/db";
import { getRequestUserId, requireAdmin } from "../lib/project-hub-auth";
import {
  safeMediaUrl,
  serializeProject,
} from "../lib/project-hub-projects";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function sanitizeMedia(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const url = safeMediaUrl(value);
  if (!url) throw new Error("Media URLs must use HTTPS or a same-site path");
  return url;
}

function requirePremiumMediaPolicy(
  access: string,
  previewVideoUrl: string | null | undefined,
): void {
  if (access === "premium" && previewVideoUrl) {
    throw new Error(
      "Premium video cannot be stored as a public URL. Private storage is not configured.",
    );
  }
}

async function recordAdminAction(
  actorId: string,
  action: string,
  projectSlug: string,
): Promise<void> {
  await db.insert(adminActionsTable).values({
    actorId,
    action,
    projectSlug,
    details: {},
  });
}

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [projectStats] = await db
    .select({
      projects: count(),
      published: sql<number>`count(*) filter (where ${projectsTable.status} = 'published')::int`,
      views: sql<number>`coalesce(sum(${projectsTable.views}), 0)::int`,
      downloads: sql<number>`coalesce(sum(${projectsTable.downloads}), 0)::int`,
      favorites: sql<number>`coalesce(sum(${projectsTable.favorites}), 0)::int`,
    })
    .from(projectsTable);
  const [users] = await db.select({ count: count() }).from(authUsersTable);
  const [subscriptions] = await db
    .select({ count: count() })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.status, "active"));
  const popularRows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.status, "published"))
    .orderBy(desc(projectsTable.views))
    .limit(5);
  const popular = await Promise.all(
    popularRows.map((row) => serializeProject(row)),
  );
  res.json(
    GetAdminOverviewResponse.parse({
      projects: projectStats.projects,
      published: projectStats.published,
      views: projectStats.views,
      downloads: projectStats.downloads,
      favorites: projectStats.favorites,
      users: users.count,
      subscriptions: subscriptions.count,
      popular,
    } satisfies AdminOverview),
  );
});

router.get("/admin/projects", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.updatedAt));
  const response = await Promise.all(rows.map((row) => serializeProject(row)));
  res.json(ListAdminProjectsResponse.parse(response));
});

router.post("/admin/projects", async (req, res): Promise<void> => {
  const body = CreateProjectBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid project details" });
    return;
  }
  const input = body.data;
  if (!isSafeSlug(input.slug)) {
    res.status(400).json({
      error: "Project URLs may contain lowercase letters, numbers, and hyphens.",
    });
    return;
  }
  let thumbnailUrl: string | null | undefined;
  let previewVideoUrl: string | null | undefined;
  let screenshots: string[] | undefined;
  try {
    thumbnailUrl = sanitizeMedia(input.thumbnailUrl);
    previewVideoUrl = sanitizeMedia(input.previewVideoUrl);
    screenshots = input.screenshots?.map((url) => {
      const safeUrl = sanitizeMedia(url);
      if (!safeUrl) throw new Error("Screenshot URL is empty");
      return safeUrl;
    });
    requirePremiumMediaPolicy(input.access, previewVideoUrl);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid media URL",
    });
    return;
  }
  const [existing] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.slug, input.slug))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "That project URL is already in use" });
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values({
      slug: input.slug,
      title: input.title.trim(),
      shortDescription: input.shortDescription.trim(),
      description: input.description.trim(),
      category: input.category.trim(),
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      access: input.access,
      status: "draft",
      featured: input.featured ?? false,
      isNew: input.isNew ?? true,
      thumbnailUrl: thumbnailUrl ?? null,
      previewVideoUrl:
        input.access === "premium" ? null : (previewVideoUrl ?? null),
      version: input.version?.trim() || "1.0.0",
      fileSize: input.fileSize ?? null,
      releaseDate:
        input.releaseDate?.toISOString().slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
      screenshots: screenshots ?? [],
      supportedDevices: input.supportedDevices ?? [],
      requirements: input.requirements ?? [],
      whatsNew: input.whatsNew?.trim() ?? "",
      changelog: input.changelog ?? [],
    })
    .returning();
  await recordAdminAction(getRequestUserId(res), "project.created", project.slug);
  res.status(201).json(CreateProjectResponse.parse(await serializeProject(project)));
});

router.patch("/admin/projects/:slug", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  const body = UpdateProjectBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid project update" });
    return;
  }
  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.slug, params.data.slug))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const input = body.data;
  const effectiveAccess = input.access ?? existing.access;
  let thumbnailUrl: string | null | undefined;
  let previewVideoUrl: string | null | undefined;
  let screenshots: string[] | undefined;
  try {
    thumbnailUrl = sanitizeMedia(input.thumbnailUrl);
    previewVideoUrl = sanitizeMedia(input.previewVideoUrl);
    screenshots = input.screenshots?.map((url) => {
      const safeUrl = sanitizeMedia(url);
      if (!safeUrl) throw new Error("Screenshot URL is empty");
      return safeUrl;
    });
    requirePremiumMediaPolicy(
      effectiveAccess,
      input.previewVideoUrl === undefined
        ? existing.previewVideoUrl
        : previewVideoUrl,
    );
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Invalid media URL",
    });
    return;
  }

  const [project] = await db
    .update(projectsTable)
    .set({
      ...(input.title === undefined ? {} : { title: input.title.trim() }),
      ...(input.shortDescription === undefined
        ? {}
        : { shortDescription: input.shortDescription.trim() }),
      ...(input.description === undefined
        ? {}
        : { description: input.description.trim() }),
      ...(input.category === undefined
        ? {}
        : { category: input.category.trim() }),
      ...(input.tags === undefined
        ? {}
        : { tags: input.tags.map((tag) => tag.trim()).filter(Boolean) }),
      ...(input.access === undefined ? {} : { access: input.access }),
      ...(input.featured === undefined ? {} : { featured: input.featured }),
      ...(input.isNew === undefined ? {} : { isNew: input.isNew }),
      ...(input.thumbnailUrl === undefined
        ? {}
        : { thumbnailUrl: thumbnailUrl ?? null }),
      ...(input.previewVideoUrl === undefined
        ? {}
        : {
            previewVideoUrl:
              effectiveAccess === "premium" ? null : (previewVideoUrl ?? null),
          }),
      ...(input.version === undefined
        ? {}
        : { version: input.version.trim() || "1.0.0" }),
      ...(input.fileSize === undefined
        ? {}
        : { fileSize: input.fileSize ?? null }),
      ...(input.releaseDate === undefined
        ? {}
        : { releaseDate: input.releaseDate.toISOString().slice(0, 10) }),
      ...(input.screenshots === undefined
        ? {}
        : { screenshots: screenshots ?? [] }),
      ...(input.supportedDevices === undefined
        ? {}
        : { supportedDevices: input.supportedDevices }),
      ...(input.requirements === undefined
        ? {}
        : { requirements: input.requirements }),
      ...(input.whatsNew === undefined
        ? {}
        : { whatsNew: input.whatsNew.trim() }),
      ...(input.changelog === undefined ? {} : { changelog: input.changelog }),
    })
    .where(eq(projectsTable.slug, params.data.slug))
    .returning();
  await recordAdminAction(getRequestUserId(res), "project.updated", project.slug);
  res.json(UpdateProjectResponse.parse(await serializeProject(project)));
});

router.delete("/admin/projects/:slug", async (req, res): Promise<void> => {
  const params = ArchiveProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project slug" });
    return;
  }
  const [project] = await db
    .update(projectsTable)
    .set({ status: "archived" })
    .where(eq(projectsTable.slug, params.data.slug))
    .returning({ slug: projectsTable.slug });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  await recordAdminAction(getRequestUserId(res), "project.archived", project.slug);
  res.json(ArchiveProjectResponse.parse({ success: true, message: "Archived" }));
});

router.put(
  "/admin/projects/:slug/publication",
  async (req, res): Promise<void> => {
    const params = SetProjectPublicationParams.safeParse(req.params);
    const body = SetProjectPublicationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid publication request" });
      return;
    }
    const [project] = await db
      .update(projectsTable)
      .set({ status: body.data.published ? "published" : "draft" })
      .where(eq(projectsTable.slug, params.data.slug))
      .returning();
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    await recordAdminAction(
      getRequestUserId(res),
      body.data.published ? "project.published" : "project.unpublished",
      project.slug,
    );
    res.json(
      SetProjectPublicationResponse.parse(await serializeProject(project)),
    );
  },
);

export default router;