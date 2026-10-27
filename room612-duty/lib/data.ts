import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildHolidayMap,
  buildSnapshot,
  todayInBangkok,
  type CycleSwap,
  type EngineConfig,
  type Snapshot,
} from "@/lib/roster-engine";
import type { AppConfigRow, Holiday, Student } from "@/lib/types";

export interface RosterData {
  students: Student[];
  config: AppConfigRow;
  holidays: Holiday[];
  swaps: CycleSwap[];
}

function unwrap<T>(label: string, res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`อ่านตาราง ${label} ไม่สำเร็จ: ${res.error.message}`);
  return res.data as T;
}

export async function loadRosterData(db: SupabaseClient): Promise<RosterData> {
  const [students, config, holidays, swaps] = await Promise.all([
    db.from("students").select("student_no, full_name, nickname").order("student_no"),
    db.from("app_config").select("id, anchor_date, anchor_step, manual_offset").eq("id", 1).maybeSingle(),
    db.from("holidays").select("holiday_date, name, kind").order("holiday_date"),
    db.from("cycle_swaps").select("*").order("created_at").order("id"),
  ]);

  const cfg = unwrap("app_config", config);
  if (!cfg) throw new Error("ไม่พบแถว app_config (id=1) — ให้รัน supabase/schema.sql ก่อน");

  const studentRows = unwrap("students", students) as Student[];
  if (studentRows.length === 0) throw new Error("ตาราง students ว่าง — ให้รัน supabase/schema.sql ก่อน");

  return {
    students: studentRows,
    config: cfg as AppConfigRow,
    holidays: unwrap("holidays", holidays) as Holiday[],
    swaps: unwrap("cycle_swaps", swaps) as CycleSwap[],
  };
}

export function toEngineConfig(c: AppConfigRow): EngineConfig {
  return { anchorDate: c.anchor_date, anchorStep: c.anchor_step, manualOffset: c.manual_offset };
}

export interface View {
  today: string;
  data: RosterData;
  snapshot: Snapshot;
}

export function computeView(data: RosterData, today: string = todayInBangkok()): View {
  const snapshot = buildSnapshot(today, toEngineConfig(data.config), buildHolidayMap(data.holidays), data.swaps);
  return { today, data, snapshot };
}
