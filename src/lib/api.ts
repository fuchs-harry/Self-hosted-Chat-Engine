import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/auth/users";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in");
  return user;
}

export async function apiAdmin(): Promise<User> {
  const user = await apiUser();
  if (user.role !== "admin") throw new HttpError(403, "Administrators only");
  return user;
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return parsed.data;
}

/** Wraps a route handler so thrown HttpErrors become JSON responses. */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      console.error("[api]", err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export const uuid = z.string().uuid();
