import { randomUUID, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import {
  GetAuthSessionResponse,
  SignInBody,
  SignInResponse,
  SignOutResponse,
  SignUpBody,
  SignUpResponse,
} from "@workspace/api-zod";
import { authSessionsTable, authUsersTable, db } from "@workspace/db";
import {
  createSession,
  getOptionalAuthUser,
  hashPassword,
  revokeCurrentSession,
  verifyPassword,
} from "../lib/project-hub-auth";

const router: IRouter = Router();

const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many sign-in attempts. Try again later." });
  },
});

const signUpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many registration attempts. Try again later." });
  },
});

function tokensMatch(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    expectedBytes.length >= 32 &&
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

function hasUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

router.get("/auth/session", (_req, res): void => {
  const user = getOptionalAuthUser(res);
  res.json(
    GetAuthSessionResponse.parse({
      authenticated: Boolean(user),
      user,
    }),
  );
});

router.post("/auth/sign-up", signUpLimiter, async (req, res): Promise<void> => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email, name, and password of at least 12 characters." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const displayName = parsed.data.displayName.trim();
  const ownerEmail = process.env.PROJECT_HUB_OWNER_EMAIL?.trim().toLowerCase();
  const setupToken = process.env.PROJECT_HUB_ADMIN_SETUP_TOKEN;
  const suppliedSetupToken = parsed.data.ownerSetupToken;
  let role: "user" | "admin" = "user";

  if (suppliedSetupToken) {
    if (!ownerEmail || !setupToken || Buffer.byteLength(setupToken, "utf8") < 32) {
      res.status(503).json({ error: "Owner account setup is not configured." });
      return;
    }
    if (email !== ownerEmail || !tokensMatch(suppliedSetupToken, setupToken)) {
      res.status(400).json({ error: "Owner account setup could not be verified." });
      return;
    }
    role = "admin";
  } else if (ownerEmail && email === ownerEmail) {
    res.status(400).json({ error: "An owner setup code is required for this email." });
    return;
  }

  if (!displayName) {
    res.status(400).json({ error: "Enter a display name." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  let user: typeof authUsersTable.$inferSelect | null = null;

  try {
    user = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(authUsersTable)
        .where(eq(authUsersTable.email, email))
        .limit(1);

      if (role === "admin") {
        const [existingAdmin] = await tx
          .select({ id: authUsersTable.id })
          .from(authUsersTable)
          .where(eq(authUsersTable.role, "admin"))
          .limit(1);

        if (existingAdmin && existingAdmin.id !== existing?.id) return null;
      }

      if (existing) {
        if (role !== "admin" || existing.role === "admin") return null;
        const [promoted] = await tx
          .update(authUsersTable)
          .set({
            passwordHash,
            displayName,
            role: "admin",
            updatedAt: new Date(),
          })
          .where(eq(authUsersTable.id, existing.id))
          .returning();
        await tx
          .delete(authSessionsTable)
          .where(eq(authSessionsTable.userId, existing.id));
        return promoted ?? null;
      }

      const [created] = await tx
        .insert(authUsersTable)
        .values({
          id: randomUUID(),
          email,
          passwordHash,
          displayName,
          role,
        })
        .returning();
      return created ?? null;
    });
  } catch (error) {
    if (!hasUniqueConstraintError(error)) throw error;
  }

  if (!user) {
    res.status(409).json({ error: "An account with these details already exists, or owner setup is no longer available." });
    return;
  }

  await createSession(req, res, user.id);
  res.status(201).json(
    SignUpResponse.parse({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    }),
  );
});

router.post("/auth/sign-in", signInLimiter, async (req, res): Promise<void> => {
  const parsed = SignInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(authUsersTable)
    .where(eq(authUsersTable.email, email))
    .limit(1);
  if (!(await verifyPassword(parsed.data.password, user?.passwordHash))) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  await createSession(req, res, user.id);
  res.json(
    SignInResponse.parse({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    }),
  );
});

router.post("/auth/sign-out", async (req, res): Promise<void> => {
  await revokeCurrentSession(req, res);
  res.json(SignOutResponse.parse({ success: true, message: "Signed out" }));
});

export default router;