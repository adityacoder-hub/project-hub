import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://*.clerk.com",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.dev",
          "https://challenges.cloudflare.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.clerk.com",
          "https://*.clerk.accounts.dev",
          "https://*.clerk.dev",
          "wss:",
        ],
        frameSrc: [
          "'self'",
          "https://*.clerk.com",
          "https://*.clerk.accounts.dev",
          "https://challenges.cloudflare.com",
        ],
        formAction: ["'self'", "https://*.clerk.com", "https://*.clerk.accounts.dev"],
      },
    },
  }),
);
app.use(
  cors((req, callback) => {
    const origin = req.get("origin");
    const host =
      req.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.get("host");
    let allowedOrigin: string | false = false;
    if (origin && host) {
      try {
        if (new URL(origin).host.toLowerCase() === host.toLowerCase()) {
          allowedOrigin = origin;
        }
      } catch {
        allowedOrigin = false;
      }
    }
    callback(null, { origin: allowedOrigin, credentials: true });
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  const host =
    req.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.get("host");
  if (!origin || !host) {
    res.status(403).json({ error: "Request origin could not be verified" });
    return;
  }
  try {
    if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
      res.status(403).json({ error: "Cross-origin request blocked" });
      return;
    }
  } catch {
    res.status(403).json({ error: "Invalid request origin" });
    return;
  }
  next();
});

app.use("/api", router);

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    req.log.error({ err: error }, "Unhandled API error");
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
