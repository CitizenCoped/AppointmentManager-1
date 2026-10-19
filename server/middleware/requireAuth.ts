import { Request, Response, NextFunction } from "express";

type PublicRoute = { method: string; pattern: RegExp };

/** Routes that may be called without a session. */
const PUBLIC_API_ROUTES: PublicRoute[] = [
  { method: "GET", pattern: /^\/api\/health\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/login\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/logout\/?$/ },
  { method: "GET", pattern: /^\/api\/auth\/me\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/register\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/mfa\/verify\/?$/ },
  { method: "GET", pattern: /^\/api\/auth\/invite\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/invite\/complete\/?$/ },
  {
    method: "GET",
    pattern: /^\/api\/public\/appointments\/[^/]+\/deposit-status\/?$/,
  },
  {
    method: "PATCH",
    pattern: /^\/api\/public\/appointments\/[^/]+\/confirm-deposit-return\/?$/,
  },
];

export function isPublicApiRoute(method: string, path: string): boolean {
  const normalized = path.split("?")[0];
  return PUBLIC_API_ROUTES.some(
    (route) =>
      route.method === method.toUpperCase() && route.pattern.test(normalized),
  );
}

/** Require an authenticated session for all non-public /api routes. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) {
    return next();
  }

  if (isPublicApiRoute(req.method, req.path)) {
    return next();
  }

  if (req.session?.userId) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
}

/** MFA setup endpoints allowed before mfaVerified is set. */
const MFA_SETUP_ROUTES: PublicRoute[] = [
  { method: "GET", pattern: /^\/api\/auth\/me\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/logout\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/mfa\/setup\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/mfa\/enable\/?$/ },
  { method: "POST", pattern: /^\/api\/auth\/mfa\/verify\/?$/ },
];

function isMfaSetupRoute(method: string, path: string): boolean {
  const normalized = path.split("?")[0];
  return MFA_SETUP_ROUTES.some(
    (route) =>
      route.method === method.toUpperCase() && route.pattern.test(normalized),
  );
}

/**
 * After password login without MFA, or before MFA enrollment completes,
 * only MFA-related endpoints are reachable.
 */
export function requireMfa(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api")) {
    return next();
  }

  if (isPublicApiRoute(req.method, req.path)) {
    return next();
  }

  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.session.mfaVerified) {
    return next();
  }

  if (isMfaSetupRoute(req.method, req.path)) {
    return next();
  }

  return res.status(403).json({
    message: "MFA required",
    needsMfaSetup: true,
  });
}
