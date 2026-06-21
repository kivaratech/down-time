import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import legalRouter from "./routes/legal";
import debugRouter from "./routes/debug";
import { logger } from "./lib/logger";
import { principalMiddleware } from "./middleware/principal";

const app: Express = express();

// Trust the first proxy hop so `req.ip` reflects the client's address
// instead of Railway's reverse proxy. Critical for the login rate limiter
// (lib express-rate-limit keys on req.ip): without this, every request
// appears to come from the same proxy IP and one user hitting the limit
// would lock out everyone behind that proxy — and an attacker could lock
// out all legitimate logins with a few hundred bad requests.
//
// Value is `1` not `true` because `true` trusts the ENTIRE x-forwarded-for
// chain, which lets an attacker spoof their client IP by injecting their
// own header. `1` trusts exactly one upstream hop (Railway's proxy), which
// is the topology in production.
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
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve Bearer token → req.principal for routes that opt in.
// Fails open: missing/invalid token leaves principal undefined and route guards 401.
app.use(principalMiddleware);

// Mount legal pages at the root (not under /api) so the public-facing URLs
// look clean — `https://.../privacy` rather than `https://.../api/privacy`.
// App Store and Play Store reviewers click these URLs from the store
// listing and the cleaner path reads more professionally.
app.use(legalRouter);

// TEMP: GCS upload diagnostic. Remove after.
app.use("/api", debugRouter);

app.use("/api", router);

export default app;
