import { and, eq } from "drizzle-orm";
import {
  ListProjectsResponseItem,
  GetProjectResponse,
  type Project,
} from "@workspace/api-zod";
import {
  db,
  favoritesTable,
  projectsTable,
  subscriptionsTable,
  type ProjectHubProject,
} from "@workspace/db";

type ProjectOutput = Project;

export function safeMediaUrl(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function hasPremiumAccess(userId: string): Promise<boolean> {
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);
  if (!subscription) return false;
  if (!["active", "cancelled"].includes(subscription.status)) return false;
  return !subscription.expiresAt || subscription.expiresAt.getTime() > Date.now();
}

export async function isProjectFavorite(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const [favorite] = await db
    .select({ id: favoritesTable.id })
    .from(favoritesTable)
    .where(
      and(
        eq(favoritesTable.userId, userId),
        eq(favoritesTable.projectId, projectId),
      ),
    )
    .limit(1);
  return Boolean(favorite);
}

export async function serializeProject(
  project: ProjectHubProject,
  options: { isFavorite?: boolean; premiumAccess?: boolean } = {},
): Promise<ProjectOutput> {
  const premiumAccess = options.premiumAccess ?? false;
  const result = {
    id: project.id,
    slug: project.slug,
    title: project.title,
    shortDescription: project.shortDescription,
    description: project.description,
    category: project.category,
    tags: project.tags,
    access: project.access === "premium" ? "premium" : "free",
    status:
      project.status === "published" || project.status === "archived"
        ? project.status
        : "draft",
    featured: project.featured,
    isNew: project.isNew,
    thumbnailUrl: safeMediaUrl(project.thumbnailUrl),
    // Premium video URLs are never included in the public project response.
    previewVideoUrl:
      project.access === "free" ? safeMediaUrl(project.previewVideoUrl) : null,
    version: project.version,
    fileSize: project.fileSize,
    views: project.views,
    downloads: project.downloads,
    favorites: project.favorites,
    releaseDate: project.releaseDate,
    updatedAt: project.updatedAt.toISOString(),
    screenshots: project.screenshots
      .map((url) => safeMediaUrl(url))
      .filter((url): url is string => url !== null),
    supportedDevices: project.supportedDevices,
    requirements: project.requirements,
    whatsNew: project.whatsNew,
    changelog: project.changelog,
    fileAvailable: project.fileAvailable && Boolean(project.downloadObjectPath),
    videoLocked:
      project.access === "premium" &&
      (!premiumAccess || !project.previewVideoObjectPath),
    ...(options.isFavorite === undefined
      ? {}
      : { isFavorite: options.isFavorite }),
  };
  return (options.isFavorite === undefined
    ? ListProjectsResponseItem.parse(result)
    : GetProjectResponse.parse(result)) as ProjectOutput;
}
