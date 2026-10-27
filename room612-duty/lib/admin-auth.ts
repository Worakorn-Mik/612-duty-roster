import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("ยังไม่ได้ตั้งค่า ADMIN_SESSION_SECRET (อย่างน้อย 16 ตัวอักษร)");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Compare fixed-length digests so length differences don't leak timing.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function pinMatches(input: string): boolean {
  const pin = process.env.ADMIN_PIN;
  if (!pin) throw new Error("ยังไม่ได้ตั้งค่า ADMIN_PIN");
  return safeEqual(input, pin);
}

export async function createAdminSession(): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(exp);
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    if (!raw) return false;
    const [payload, sig] = raw.split(".");
    if (!payload || !sig) return false;
    if (!safeEqual(sig, sign(payload))) return false;
    return Number(payload) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/* ---- best-effort brute-force throttle ----
 * In-memory, so on serverless it is per-instance only. It slows casual guessing;
 * the real protection is a long ADMIN_PIN. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export function isThrottled(key: string): boolean {
  const e = attempts.get(key);
  if (!e) return false;
  if (Date.now() - e.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return e.count >= MAX_ATTEMPTS;
}

export function recordFailure(key: string): void {
  const e = attempts.get(key);
  if (!e || Date.now() - e.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else e.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
