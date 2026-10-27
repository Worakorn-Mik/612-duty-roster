export interface Student {
  student_no: number;
  full_name: string;
  nickname: string;
}

export type HolidayKind = "national" | "school" | "special";

export interface Holiday {
  holiday_date: string; // YYYY-MM-DD
  name: string;
  kind: HolidayKind;
}

export interface AppConfigRow {
  id: number;
  anchor_date: string;
  anchor_step: number;
  manual_offset: number;
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
