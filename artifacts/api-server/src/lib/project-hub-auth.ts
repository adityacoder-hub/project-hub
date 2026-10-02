import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import {
  authSessionsTable,
  authUsersTable,
  db,
  type ProjectHubRole,
} from "@workspace/db";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: 64 * 1024 * 1024,
};
const DUMMY_SALT = Buffer.from("project-hub-auth-dummy-salt", "utf8");
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = "project_hub_session";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: ProjectHubRole;
};

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_OPTIONS,
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encodedHash: string | null | undefined,
): Promise<boolean> {
  if (!encodedHash) {
    await derivePasswordKey(password, DUMMY_SALT);
    return false;
  }

  const [algorithm, n, r, p, saltText, hashText, extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== String(SCRYPT_N) ||
    r !== String(SCRYPT_R) ||
    p !== String(SCRYPT_P) ||
    !saltText ||
    !hashText ||
    extra !== undefined
  ) {
    await derivePasswordKey(password, DUMMY_SALT);
    return false;
  }

  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  if (salt.length !== 16 || expected.length !== SCRYPT_KEY_LENGTH) {
    await derivePasswordKey(password, DUMMY_SALT);
    return false;
  }

  const actual = await derivePasswordKey(password, salt);
  return timingSafeEqual(actual, expected);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function validSessionToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

function cookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || req.secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createSession(
  req: Request,
  res: Response,
  userId: string,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await db.insert(authSessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(req),
    maxAge: SESSION_LIFETIME_MS,
  });
}

export async function revokeCurrentSession(
  req: Request,
  res: Response,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (validSessionToken(token)) {
    await db
      .delete(authSessionsTable)
      .where(eq(authSessionsTable.tokenHash, hashSessionToken(token)));
  }
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(req));
}

export const authSessionMiddleware: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  res.locals.authUser = null;

  if (!validSessionToken(token)) {
    if (typeof token === "string" && token.length > 0) {
      res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(req));
    }
    next();
    return;
  }

  const tokenHash = hashSessionToken(token);
  const [session] = await db
    .select({
      id: authUsersTable.id,
      email: authUsersTable.email,
      displayName: authUsersTable.displayName,
      role: authUsersTable.role,
      expiresAt: authSessionsTable.expiresAt,
    })
    .from(authSessionsTable)
    .innerJoin(authUsersTable, eq(authSessionsTable.userId, authUsersTable.id))
    .where(
      and(
        eq(authSessionsTable.tokenHash, tokenHash),
        gt(authSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) {
    await db
      .delete(authSessionsTable)
      .where(eq(authSessionsTable.tokenHash, tokenHash));
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(req));
    next();
    return;
  }

  res.locals.authUser = {
    id: session.id,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
  } satisfies AuthUser;
  next();
};

export function getOptionalAuthUser(res: Response): AuthUser | null {
  return (res.locals.authUser as AuthUser | null | undefined) ?? null;
}

export function getRequestAuthUser(res: Response): AuthUser {
  const user = getOptionalAuthUser(res);
  if (!user) {
    throw new Error("Authenticated user is missing from request context");
  }
  return user;
}

export function getRequestUserId(res: Response): string {
  return getRequestAuthUser(res).id;
}

export const requireUser: RequestHandler = (_req, res, next) => {
  if (!getOptionalAuthUser(res)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  const user = getOptionalAuthUser(res);
  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
};