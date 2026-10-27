"use server";

import { revalidatePath } from "next/cache";
import {
  clearFailures,
  clientKey,
  createAdminSession,
  destroyAdminSession,
  isAdmin,
  isThrottled,
  pinMatches,
  recordFailure,
} from "@/lib/admin-auth";
import { getAdminClient } from "@/lib/supabase-server";
import { computeView, loadRosterData } from "@/lib/data";
import {
  STUDENT_COUNT,
  findStudent,
  getEffectiveRoster,
  isValidISODate,
  todayInBangkok,
} from "@/lib/roster-engine";
import type { ActionResult, HolidayKind } from "@/lib/types";

const fail = (error: string): ActionResult => ({ ok: false, error });

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin");
}

async function guard(): Promise<ActionResult | null> {
  return (await isAdmin()) ? null : fail("เซสชันหมดอายุ — กรุณาใส่ PIN อีกครั้ง");
}

function cleanName(raw: string | undefined, fallback: string): string {
  const s = (raw ?? "").trim().slice(0, 80);
  return s.length > 0 ? s : fallback;
}

/* ------------------------------ auth ------------------------------ */

export async function login(pin: string): Promise<ActionResult> {
  try {
    const key = await clientKey();
    if (isThrottled(key)) return fail("ใส่ PIN ผิดหลายครั้งเกินไป — ลองใหม่อีกครั้งใน 10 นาที");
    if (typeof pin !== "string" || pin.length === 0 || pin.length > 128) return fail("PIN ไม่ถูกต้อง");
    if (!pinMatches(pin)) {
      recordFailure(key);
      await new Promise((r) => setTimeout(r, 500));
      return fail("PIN ไม่ถูกต้อง");
    }
    clearFailures(key);
    await createAdminSession();
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
  }
}

export async function logout(): Promise<ActionResult> {
  await destroyAdminSession();
  return { ok: true };
}

/* --------------------------- queue shift --------------------------- */

export async function shiftQueue(delta: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (delta !== 1 && delta !== -1) return fail("ค่าที่ส่งมาไม่ถูกต้อง");
  try {
    const { error } = await getAdminClient().rpc("shift_manual_offset", { delta });
    if (error) return fail(error.message);
    refresh();
    return { ok: true, message: delta === 1 ? "เดินหน้าคิว 1 คิวแล้ว" : "ถอยคิว 1 คิวแล้ว" };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "ปรับคิวไม่สำเร็จ");
  }
}

/* ---------------------------- cycle swaps --------------------------- */

export async function createSwap(studentA: number, studentB: number, note?: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const valid = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= STUDENT_COUNT;
  if (!valid(studentA) || !valid(studentB)) return fail("เลือกนักเรียนไม่ถูกต้อง");
  if (studentA === studentB) return fail("ต้องเลือกนักเรียนสองคนที่ไม่ซ้ำกัน");

  try {
    const db = getAdminClient();
    const view = computeView(await loadRosterData(db), todayInBangkok());
    const cycle = view.snapshot.today.cycle;

    const eff = getEffectiveRoster(cycle, view.data.swaps);
    const pa = findStudent(eff, studentA);
    const pb = findStudent(eff, studentB);
    if (!pa || !pb) return fail("ไม่พบนักเรียนในตารางเวร");
    if (pa.slot === pb.slot) return fail("สองคนนี้อยู่คิวเดียวกันอยู่แล้ว ไม่ต้องสลับ");

    // Don't rewrite history: both seats must still be today or in the future.
    if (view.snapshot.roster[pa.slot].isPast || view.snapshot.roster[pb.slot].isPast) {
      return fail("สลับกับคิวที่ผ่านไปแล้วไม่ได้ — เลือกคนที่ยังไม่ถึงเวรในรอบนี้");
    }

    const { error } = await db.from("cycle_swaps").insert({
      cycle_number: cycle,
      student_a: studentA,
      student_b: studentB,
      slot_a_index: pa.slot,
      slot_b_index: pb.slot,
      note: note?.trim().slice(0, 200) || null,
    });
    if (error) return fail(error.message);
    refresh();
    return { ok: true, message: `สลับเวรเลขที่ ${studentA} ↔ ${studentB} เฉพาะรอบที่ ${cycle} แล้ว` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "สลับเวรไม่สำเร็จ");
  }
}

export async function revertSwap(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!Number.isInteger(id)) return fail("รหัสรายการไม่ถูกต้อง");
  try {
    const { error } = await getAdminClient().from("cycle_swaps").delete().eq("id", id);
    if (error) return fail(error.message);
    refresh();
    return { ok: true, message: "ยกเลิกการสลับแล้ว" };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
  }
}

/* ------------------------------ holidays ---------------------------- */

export async function setTodayHoliday(name?: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    const today = todayInBangkok();
    const { error } = await getAdminClient()
      .from("holidays")
      .upsert({ holiday_date: today, name: cleanName(name, "วันหยุดพิเศษ"), kind: "special" }, { onConflict: "holiday_date" });
    if (error) return fail(error.message);
    refresh();
    return { ok: true, message: "ตั้งวันนี้เป็นวันหยุดแล้ว — คิววันนี้เลื่อนไปวันทำการถัดไป" };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "ตั้งวันหยุดไม่สำเร็จ");
  }
}

export async function addHoliday(date: string, name: string, kind: HolidayKind = "school"): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (typeof date !== "string" || !isValidISODate(date)) return fail("วันที่ไม่ถูกต้อง");
  if (!["national", "school", "special"].includes(kind)) return fail("ประเภทวันหยุดไม่ถูกต้อง");
  // Adding a holiday in the past would silently shift today's queue backwards.
  if (date < todayInBangkok()) return fail("เพิ่มวันหยุดย้อนหลังไม่ได้ เพราะจะทำให้คิวของวันนี้เปลี่ยน");
  try {
    const { error } = await getAdminClient()
      .from("holidays")
      .upsert({ holiday_date: date, name: cleanName(name, "วันหยุดโรงเรียน"), kind }, { onConflict: "holiday_date" });
    if (error) return fail(error.message);
    refresh();
    return { ok: true, message: "บันทึกวันหยุดแล้ว" };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "บันทึกวันหยุดไม่สำเร็จ");
  }
}

export async function removeHoliday(date: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (typeof date !== "string" || !isValidISODate(date)) return fail("วันที่ไม่ถูกต้อง");
  if (date < todayInBangkok()) return fail("ลบวันหยุดย้อนหลังไม่ได้ เพราะจะทำให้คิวของวันนี้เปลี่ยน");
  try {
    const { error } = await getAdminClient().from("holidays").delete().eq("holiday_date", date);
    if (error) return fail(error.message);
    refresh();
    return { ok: true, message: "ลบวันหยุดแล้ว" };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "ลบวันหยุดไม่สำเร็จ");
  }
}
