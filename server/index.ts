import express, { type Request, Response, NextFunction } from "express";
import type { Server } from "http";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { log } from "./logger";
import { serveStatic } from "./static";
import { storage, DatabaseStorage } from "./storage";
import { db } from "./db";
import { ensureCashCollectionLog } from "./ensureCashCollectionLog";

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

let resolveReady: () => void;
const ready = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

// Hold requests until routes/static are registered (needed for Vercel cold start)
app.use(async (_req, _res, next) => {
  await ready;
  next();
});

let httpServer: Server;

async function bootstrap() {
  try {
    httpServer = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    const isDev =
      app.get("env") === "development" || process.env.NODE_ENV === "development";

    if (isDev && !process.env.VERCEL) {
      // Expression import so esbuild does not bundle vite/rollup into dist/index.js
      const { pathToFileURL } = await import("url");
      const { join } = await import("path");
      const { setupVite } = await import(
        pathToFileURL(join(import.meta.dirname, "vite.ts")).href
      );
      await setupVite(app, httpServer);
    } else {
      serveStatic(app);
    }
  } catch (error) {
    log(`Error during bootstrap: ${(error as Error).message}`);
    console.error(error);
  } finally {
    // Always open the gate so requests do not hang forever on cold start
    resolveReady!();
  }

  try {
    log("Pushing database schema...");
    await db.execute(
      `CREATE TABLE IF NOT EXISTS _drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at timestamp with time zone DEFAULT now()
      )`,
    );

    log("Initializing default data...");
    if (storage instanceof DatabaseStorage) {
      await storage.initializeDefaultProviders();
    }
  } catch (error) {
    log(`Error initializing database: ${(error as Error).message}`);
    console.error(error);
  }

  // The appointments table carries a legacy trigger that writes to
  // cash_collection_log. If that table is missing (restore, drizzle push),
  // every appointment update fails, so recreate it on each cold start.
  try {
    log("Ensuring cash_collection_log table exists...");
    await ensureCashCollectionLog((statement) => db.execute(statement));
  } catch (error) {
    log(`Error ensuring cash_collection_log: ${(error as Error).message}`);
    console.error(error);
  }
}

const bootstrapPromise = bootstrap();

export default app;

// Local `tsx server/index.ts` listen path.
// Production/Vercel uses root `server.js` which imports this app and listens on PORT.
if (!process.env.VERCEL && process.env.npm_lifecycle_event !== "start") {
  bootstrapPromise
    .then(() => {
      const port = Number(process.env.PORT) || 5050;
      httpServer.listen(
        {
          port,
          host: "0.0.0.0",
        },
        () => {
          log(`serving on port ${port}`);
        },
      );
    })
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}
