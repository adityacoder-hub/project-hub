import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetProjectParams,
  GetProjectResponse,
  ListProjectsQueryParams,
  ListProjectsResponse,
  RecordProjectViewParams,
  RecordProjectViewResponse,
  RequestProjectDownloadParams,
  RequestProjectDownloadResponse,
} from "@workspace/api-zod";
import { db, projectViewsTable, projectsTable } from "@workspace/db";
import {
  hasPremiumAccess,
  isProjectFavorite,
  serializeProject,
} from "../lib/project-hub-projects";
import { getOptionalAuthUser } from "../lib/project-hub-auth";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  const parsedQuery = ListProjectsQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid project filters" });
    return;
  }

  const filters = [eq(projectsTable.status, "published")];
  const { q, category, access, sort, featured } = parsedQuery.data;
  const search = q?.trim().slice(0, 120);
  if (search) {
    const pattern = `%${search}%`;
    filters.push(
      or(
        ilike(projectsTable.title, pattern),
        ilike(projectsTable.shortDescription, pattern),
        ilike(projectsTable.description, pattern),
        ilike(projectsTable.category, pattern),
        sql`${projectsTable.tags}::text ILIKE ${pattern}`,
      )!,
    );
  }
  if (category) filters.push(eq(projectsTable.category, category));
  if (access && access !== "all") filters.push(eq(projectsTable.access, access));
  if (featured) filters.push(eq(projectsTable.featured, true));

  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(...filters))
    .orderBy(
      sort === "popular"
        ? desc(projectsTable.views)
        : desc(projectsTable.updatedAt),
    );

  const response = await Promise.all(rows.map((row) => serializeProject(row)));
  res.json(ListProjectsResponse.parse(response));
});

router.get("/projects/:slug", async (req, res): Promise<void> => {
  const parsedParams = GetProjectParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid project slug" });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.slug, parsedParams.data.slug),
        eq(projectsTable.status, "published"),
      ),
    )
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = getOptionalAuthUser(res)?.id;
  const [isFavorite, premiumAccess] = userId
    ? await Promise.all([
        isProjectFavorite(userId, project.id),
        hasPremiumAccess(userId),
      ])
    : [false, false];
  res.json(
    GetProjectResponse.parse(
      await serializeProject(project, { isFavorite, premiumAccess }),
    ),
  );
});

router.post("/projects/:slug/views", async (req, res): Promise<void> => {
  const parsedParams = RecordProjectViewParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid project slug" });
    return;
  }
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.slug, parsedParams.data.slug),
        eq(projectsTable.status, "published"),
      ),
    )
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db.insert(projectViewsTable).values({
    projectId: project.id,
    userId: getOptionalAuthUser(res)?.id ?? null,
  });
  await db
    .update(projectsTable)
    .set({ views: sql`${projectsTable.views} + 1` })
    .where(eq(projectsTable.id, project.id));
  res.json(RecordProjectViewResponse.parse({ success: true, message: null }));
});

router.post("/projects/:slug/download", async (req, res): Promise<void> => {
  const parsedParams = RequestProjectDownloadParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid project slug" });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.slug, parsedParams.data.slug),
        eq(projectsTable.status, "published"),
      ),
    )
    .limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const userId = getOptionalAuthUser(res)?.id;
  if (project.access === "premium") {
    if (!userId) {
      res.status(401).json({ error: "Sign in to check premium access" });
      return;
    }
    if (!(await hasPremiumAccess(userId))) {
      res.status(403).json({ error: "An active premium subscription is required" });
      return;
    }
  }

  // No direct file URLs are ever returned. File storage was not available when
  // this app was provisioned, so the server fails explicitly until a private
  // object path has been attached to the project.
  if (!project.fileAvailable || !project.downloadObjectPath) {
    res.status(403).json({ error: "The owner has not added a downloadable file yet" });
    return;
  }

  res.json(
    RequestProjectDownloadResponse.parse({
      success: false,
      downloadUrl: null,
      message: "Private file delivery is not configured.",
    }),
  );
});

export default router;