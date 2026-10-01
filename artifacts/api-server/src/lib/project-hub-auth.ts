import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

export const requireUser: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.userId = userId;
  next();
};

export async function isOwnerUser(userId: string): Promise<boolean> {
  const allowedEmail = process.env.PROJECT_HUB_OWNER_EMAIL?.trim().toLowerCase();
  if (!allowedEmail) return false;

  const user = await clerkClient.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  return Boolean(
    primaryEmail &&
      primaryEmail.verification?.status === "verified" &&
      primaryEmail.emailAddress.trim().toLowerCase() === allowedEmail,
  );
}

export const requireOwner: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!process.env.PROJECT_HUB_OWNER_EMAIL?.trim()) {
    res.status(403).json({
      error: "Owner access is not configured. Set PROJECT_HUB_OWNER_EMAIL.",
    });
    return;
  }
  if (!(await isOwnerUser(userId))) {
    res.status(403).json({ error: "Owner access required" });
    return;
  }

  res.locals.userId = userId;
  next();
};

export function getRequestUserId(res: {
  locals: Record<string, unknown>;
}): string {
  const userId = res.locals.userId;
  if (typeof userId !== "string") {
    throw new Error("Authenticated user id is missing from request context");
  }
  return userId;
}