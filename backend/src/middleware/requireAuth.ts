import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

// passport's types already declare `Express.Request.user?: Express.User`.
// We merge our fields into `Express.User` (rather than redeclaring
// `Request.user` with a different type) so `req.user` stays a single
// consistent type everywhere, including inside the passport callback.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends AuthedUser {}
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.["auth_token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthedUser;
    req.user = decoded as Express.User;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Same as requireAuth but does not reject the request if no/invalid token —
// useful for endpoints that behave differently for logged-in vs anon users.
export function attachUserIfPresent(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token = req.cookies?.["auth_token"];
  if (token) {
    try {
      req.user = jwt.verify(token, env.jwtSecret) as Express.User;
    } catch {
      /* ignore */
    }
  }
  next();
}
