import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, requireRole, signToken } from "../lib/auth.js";
import { HttpError, notFound, param } from "../lib/http.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.email().transform((e) => e.toLowerCase()), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong email or password");
  }
  const authUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(authUser), user: authUser });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---- Staff accounts (admin only) ----------------------------------------

export const usersRouter = Router();
usersRouter.use(requireAuth);

const publicUser = { id: users.id, name: users.name, email: users.email, role: users.role, active: users.active };

usersRouter.get("/", async (_req, res) => {
  // Everyone can see the staff list (needed for "Assign counsellor").
  res.json({ users: await db.select(publicUser).from(users).where(eq(users.active, true)).orderBy(asc(users.name)) });
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8),
  role: z.enum(["admin", "front_desk", "counsellor"]),
});

usersRouter.post("/", requireRole("admin"), async (req, res) => {
  const body = createSchema.parse(req.body);
  const exists = await db.query.users.findFirst({ where: eq(users.email, body.email) });
  if (exists) throw new HttpError(409, "A user with this email already exists");
  const [user] = await db
    .insert(users)
    .values({ name: body.name, email: body.email, role: body.role, passwordHash: await bcrypt.hash(body.password, 10) })
    .returning(publicUser);
  res.status(201).json({ user });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "front_desk", "counsellor"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

usersRouter.patch("/:id", requireRole("admin"), async (req, res) => {
  const body = updateSchema.parse(req.body);
  const { password, ...rest } = body;
  const [user] = await db
    .update(users)
    .set({ ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}), updatedAt: new Date() })
    .where(eq(users.id, param(req.params.id)))
    .returning(publicUser);
  if (!user) throw notFound("User");
  res.json({ user });
});
