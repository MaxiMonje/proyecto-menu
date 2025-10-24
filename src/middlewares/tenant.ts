import { Request, Response, NextFunction } from "express";
import User from "../models/User";

declare global {
  namespace Express {
    interface Request {
      tenant?: {
        id: number;
        subdomain: string;
        user : User;
      };
    }
  }
}

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let subdomain: string | null =
      (req.get("x-tenant-subdomain") as string) ||
      ((req.query.tenant as string) ?? null);

    if (!subdomain) {
      return res.status(400).json({
        error: "Tenant not specified. Use x-tenant-subdomain header or ?tenant= param",
      });
    }

    subdomain = subdomain.toLowerCase();

    const user = await User.findOne({
      where: { subdomain, active: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found or inactive" });
    }
    
    req.tenant = {
      id: user.id,
      subdomain: user.subdomain,
      user,
    };

    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
