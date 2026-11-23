/**
 * Synthetic fixture repositories for the evaluation harness.
 *
 * Each fixture is a small TS project where we KNOW the dependency structure, so
 * the ground-truth impacted files for a change are objective (see dataset.ts).
 *
 * A root-level `package.json` is included in each so intake does not strip a
 * common `src/` prefix — keeping paths stable as `src/...`.
 */
export type Fixture = Record<string, string>;

export const fixtures: Record<string, Fixture> = {
  // ── shop: math ← coupon/tax ← cart ← index ──────────────────
  shop: {
    "package.json": "{}\n",
    "src/utils/math.ts":
      "export function add(a: number, b: number) { return a + b; }\n" +
      "export function mul(a: number, b: number) { return a * b; }\n",
    "src/checkout/coupon.ts":
      'import { add } from "../utils/math";\n' +
      "export function applyCoupon(total: number, amount: number) { return add(total, -amount); }\n",
    "src/checkout/tax.ts":
      'import { mul } from "../utils/math";\n' +
      "export function applyTax(total: number, rate: number) { return mul(total, rate); }\n",
    "src/checkout/cart.ts":
      'import { applyCoupon } from "./coupon";\n' +
      "export class Cart {\n  total = 0;\n  checkout(couponAmount: number) { return applyCoupon(this.total, couponAmount); }\n}\n",
    "src/index.ts":
      'import { Cart } from "./checkout/cart";\n' +
      'import { applyTax } from "./checkout/tax";\n' +
      "export function order(amount: number, rate: number) {\n  const cart = new Cart();\n  cart.total = amount;\n  return applyTax(cart.checkout(0), rate);\n}\n",
    "src/index.test.ts": 'import { order } from "./index";\n// smoke test\n',
  },

  // ── auth: session ← token ← login/middleware ← routes ───────
  auth: {
    "package.json": "{}\n",
    "src/auth/session.ts":
      "export function createSession(userId: string) { return { userId, createdAt: Date.now() }; }\n" +
      "export function destroySession(id: string) { return id; }\n",
    "src/auth/token.ts":
      'import { createSession } from "./session";\n' +
      "export function signToken(userId: string) { return createSession(userId); }\n" +
      "export function verifyToken(token: string) { return token.length > 0; }\n",
    "src/auth/login.ts":
      'import { signToken } from "./token";\n' +
      'import { destroySession } from "./session";\n' +
      "export function login(user: string) { return signToken(user); }\n" +
      "export function logout(id: string) { return destroySession(id); }\n",
    "src/middleware.ts":
      'import { verifyToken } from "./auth/token";\n' +
      "export function requireAuth(token: string) { return verifyToken(token); }\n",
    "src/routes/profile.ts":
      'import { requireAuth } from "../middleware";\n' +
      "export function getProfile(token: string) { return requireAuth(token) ? { ok: true } : null; }\n",
  },

  // ── api: db ← user model ← handlers ← router ────────────────
  api: {
    "package.json": "{}\n",
    "src/db.ts": "export function query<T>(sql: string): T[] { void sql; return []; }\n",
    "src/models/user.ts":
      'import { query } from "../db";\n' +
      "export interface User { id: number; name: string; }\n" +
      'export function findUser(id: number) { return query<User>("select"); }\n' +
      'export function createUser(name: string) { return query<User>("insert"); }\n',
    "src/handlers/users.ts":
      'import { findUser, createUser } from "../models/user";\n' +
      "export function listUsers() { return findUser(0); }\n" +
      "export function addUser(name: string) { return createUser(name); }\n",
    "src/router.ts":
      'import { listUsers, addUser } from "./handlers/users";\n' +
      'export const routes = { "GET /users": listUsers, "POST /users": addUser };\n',
  },

  // ── ui: Button ← Modal ← Dialog ← App ───────────────────────
  ui: {
    "package.json": "{}\n",
    "src/components/Button.ts":
      "export function Button(label: string) { return { label }; }\n",
    "src/components/Modal.ts":
      'import { Button } from "./Button";\n' +
      "export function Modal(title: string) { return { title, close: Button(\"x\") }; }\n",
    "src/components/Dialog.ts":
      'import { Modal } from "./Modal";\n' +
      "export function Dialog(msg: string) { return Modal(msg); }\n",
    "src/App.ts":
      'import { Dialog } from "./components/Dialog";\n' +
      'import { Button } from "./components/Button";\n' +
      "export function App() { return { dialog: Dialog(\"hi\"), ok: Button(\"ok\") }; }\n",
  },

  // ── events: a tiny mitt-style emitter ───────────────────────
  events: {
    "package.json": "{}\n",
    "src/emitter.ts":
      "type Handler = (e: unknown) => void;\n" +
      "export function emitter() {\n" +
      "  const map = new Map<string, Handler[]>();\n" +
      "  return {\n" +
      "    on(type: string, h: Handler) { (map.get(type) ?? map.set(type, []).get(type)!).push(h); },\n" +
      "    off(type: string, h: Handler) { const a = map.get(type); if (a) a.splice(a.indexOf(h) >>> 0, 1); },\n" +
      "    emit(type: string, e: unknown) { (map.get(type) ?? []).forEach((h) => h(e)); },\n" +
      "  };\n" +
      "}\n",
    "src/index.ts":
      'import { emitter } from "./emitter";\n' +
      "export function createApp() { return { bus: emitter() }; }\n",
  },
};
