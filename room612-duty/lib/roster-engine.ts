/**
 * Roster engine — pure functions only (no I/O), so it can be unit-tested and
 * reused on server and client.
 *
 * All dates are plain calendar strings "YYYY-MM-DD" (Asia/Bangkok calendar).
 * Arithmetic is done on UTC midnights, so there are no DST/timezone surprises.
 * The ONLY place a real instant is converted to a calendar date is
 * `todayInBangkok()`.
 */

export const TIMEZONE = "Asia/Bangkok";
export const CYCLE_LENGTH = 14;
const MS_DAY = 86_400_000;

/** Base roster: 14 slots per cycle, values are student numbers (เลขที่). */
export const BASE_ROSTER: ReadonlyArray<ReadonlyArray<number>> = [
  [8, 26], // คิวที่ 1  (index 0)
  [14, 2], // คิวที่ 2  (index 1)
  [9, 10], // คิวที่ 3
  [13, 11], // คิวที่ 4
  [12, 25], // คิวที่ 5
  [23, 27], // คิวที่ 6
  [6, 24], // คิวที่ 7
  [7, 3], // คิวที่ 8
  [22, 16], // คิวที่ 9
  [20, 4], // คิวที่ 10
  [17, 5], // คิวที่ 11
  [19, 21], // คิวที่ 12
  [15, 1], // คิวที่ 13
  [18], // คิวที่ 14 (คนเดียว)
];

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface EngineConfig {
  anchorDate: string; // YYYY-MM-DD
  anchorStep: number;
  manualOffset: number;
}

/** date (YYYY-MM-DD) -> holiday name */
export type HolidayMap = ReadonlyMap<string, string>;

export interface CycleSwap {
  id: number;
  cycle_number: number;
  student_a: number;
  student_b: number;
  slot_a_index: number;
  slot_b_index: number;
  note: string | null;
  created_at: string;
}

export interface DayInfo {
  date: string;
  isWorking: boolean;
  nonWorkingReason: "weekend" | "holiday" | null;
  holidayName: string | null;
  /**
   * Duty step. For a working day: the step of that day.
   * For a non-working day: the step the NEXT working day will have.
   */
  step: number;
  cycle: number; // 1-based
  index: number; // 0..13
}

export interface DutyMember {
  studentNo: number;
  /** Student who would normally hold this seat (base roster), if different. */
  swappedWith: number | null;
}

export interface ScheduleEntry {
  date: string;
  cycle: number;
  index: number;
  members: DutyMember[];
}

export interface RosterRow extends ScheduleEntry {
  isPast: boolean;
  isToday: boolean;
  isCurrent: boolean; // the queue that is "on duty now" or "up next" when today is off
}

export interface StudentSchedule {
  studentNo: number;
  /** Queue index of this student in the current cycle (after swaps). */
  currentIndex: number;
  currentDate: string;
  /** The next duty date on/after today (current cycle if still ahead, else next cycle). */
  upcomingDate: string;
  upcomingIndex: number;
  upcomingCycle: number;
  isOnDutyToday: boolean;
}

export interface Snapshot {
  today: DayInfo;
  todayMembers: DutyMember[] | null; // null when today is not a working day
  /** Next working day after today (for non-working today: the first working day after today) */
  next: ScheduleEntry;
  /** Next 5 working days after today (first element === next) */
  forecast: ScheduleEntry[];
  roster: RosterRow[]; // all 14 queues of the current cycle
  students: StudentSchedule[]; // 27 entries, by student number
  /** Cycle / index that headline UI should show (today's, or next-up when off). */
  headline: { cycle: number; index: number };
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function toUTCms(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUTCms(ms: number): string {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function addDays(date: string, n: number): string {
  return fromUTCms(toUTCms(date) + n * MS_DAY);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: string): number {
  return new Date(toUTCms(date)).getUTCDay();
}

export function isWeekend(date: string): boolean {
  const d = dayOfWeek(date);
  return d === 0 || d === 6;
}

/** Calendar date in Asia/Bangkok for a given instant (default: now). Day rolls over at 00:00:00 Bangkok time. */
export function todayInBangkok(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Milliseconds until the next 00:00:00 in Bangkok (Bangkok has no DST: UTC+7). */
export function msUntilBangkokMidnight(now: number = Date.now()): number {
  const offset = 7 * 3_600_000;
  return MS_DAY - ((now + offset) % MS_DAY);
}

const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const thaiWeekday = (date: string) => WEEKDAYS[dayOfWeek(date)];
export const thaiMonthName = (month1to12: number) => MONTHS[month1to12 - 1];

/** "วันอังคารที่ 27 ตุลาคม 2569" */
export function formatThaiDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `วัน${WEEKDAYS[dayOfWeek(date)]}ที่ ${d} ${MONTHS[m - 1]} ${y + 543}`;
}

/** "อ. 27 ต.ค." (adds พ.ศ. 2 digits only if `withYear`) */
export function formatThaiShort(date: string, withYear = false): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = `${WEEKDAYS_SHORT[dayOfWeek(date)]} ${d} ${MONTHS_SHORT[m - 1]}`;
  return withYear ? `${base} ${String(y + 543).slice(-2)}` : base;
}

/* ------------------------------------------------------------------ */
/* Calendar / step math                                                */
/* ------------------------------------------------------------------ */

export function buildHolidayMap(rows: ReadonlyArray<{ holiday_date: string; name: string }>): Map<string, string> {
  return new Map(rows.map((r) => [r.holiday_date, r.name]));
}

export function isWorkingDay(date: string, holidays: HolidayMap): boolean {
  return !isWeekend(date) && !holidays.has(date);
}

export function nextWorkingDay(date: string, holidays: HolidayMap): string {
  let d = addDays(date, 1);
  for (let i = 0; i < 4000; i++) {
    if (isWorkingDay(d, holidays)) return d;
    d = addDays(d, 1);
  }
  throw new Error("No working day found within 4000 days — check the holidays table.");
}

export function prevWorkingDay(date: string, holidays: HolidayMap): string {
  let d = addDays(date, -1);
  for (let i = 0; i < 4000; i++) {
    if (isWorkingDay(d, holidays)) return d;
    d = addDays(d, -1);
  }
  throw new Error("No working day found within 4000 days — check the holidays table.");
}

/**
 * Cumulative step of `date` (including manual offset).
 * For a working day this is its duty step; for a non-working day it is the
 * step of the last working day before it.
 *
 *   step(date) = anchorStep + W(date) - 1 + manualOffset
 *   W(date) = #working days in [anchor, date]               (date >= anchor)
 *           = -#working days in [date+1, anchor-1]          (date <  anchor)
 *
 * When the anchor is a working day this equals the spec formula
 *   anchor_step + active_days_elapsed + manual_offset
 * (active_days_elapsed = working days in (anchor, date]). Using [anchor, date]
 * additionally keeps the numbering correct if an admin marks the anchor date
 * itself as a holiday (the first working day after it then gets anchorStep).
 */
export function stepOf(date: string, cfg: EngineConfig, holidays: HolidayMap): number {
  let w = 0;
  const a = toUTCms(cfg.anchorDate);
  const t = toUTCms(date);
  if (t >= a) {
    for (let ms = a; ms <= t; ms += MS_DAY) if (isWorkingDay(fromUTCms(ms), holidays)) w++;
  } else {
    for (let ms = t + MS_DAY; ms < a; ms += MS_DAY) if (isWorkingDay(fromUTCms(ms), holidays)) w--;
  }
  return cfg.anchorStep + w - 1 + cfg.manualOffset;
}

export const cycleOfStep = (step: number) => Math.floor(step / CYCLE_LENGTH) + 1;
export const indexOfStep = (step: number) => ((step % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;

export function getDayInfo(date: string, cfg: EngineConfig, holidays: HolidayMap): DayInfo {
  const weekend = isWeekend(date);
  const holidayName = holidays.get(date) ?? null;
  const isWorking = !weekend && holidayName === null;
  const last = stepOf(date, cfg, holidays);
  const step = isWorking ? last : last + 1;
  return {
    date,
    isWorking,
    nonWorkingReason: weekend ? "weekend" : holidayName !== null ? "holiday" : null,
    holidayName,
    step,
    cycle: cycleOfStep(step),
    index: indexOfStep(step),
  };
}

/**
 * Calendar date of duty step `target`, given a reference working day
 * (`refDate`) whose step is `refStep`. Walks forward/backward over working days.
 */
export function dateForStep(target: number, refDate: string, refStep: number, holidays: HolidayMap): string {
  let d = refDate;
  if (target >= refStep) {
    for (let i = 0; i < target - refStep; i++) d = nextWorkingDay(d, holidays);
  } else {
    for (let i = 0; i < refStep - target; i++) d = prevWorkingDay(d, holidays);
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Roster + swaps                                                      */
/* ------------------------------------------------------------------ */

export function findStudent(roster: ReadonlyArray<ReadonlyArray<number>>, studentNo: number): { slot: number; pos: number } | null {
  for (let slot = 0; slot < roster.length; slot++) {
    const pos = roster[slot].indexOf(studentNo);
    if (pos !== -1) return { slot, pos };
  }
  return null;
}

/** Swap two students' seats in place. Returns false (and does nothing) if impossible. */
export function applySwap(roster: number[][], a: number, b: number): boolean {
  if (a === b) return false;
  const pa = findStudent(roster, a);
  const pb = findStudent(roster, b);
  if (!pa || !pb) return false;
  roster[pa.slot][pa.pos] = b;
  roster[pb.slot][pb.pos] = a;
  return true;
}

/** Base roster with only the swaps of `cycle` applied (in creation order). */
export function getEffectiveRoster(cycle: number, swaps: ReadonlyArray<CycleSwap>): number[][] {
  const roster = BASE_ROSTER.map((slot) => [...slot]);
  const relevant = swaps
    .filter((s) => s.cycle_number === cycle)
    .sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at) || x.id - y.id);
  for (const s of relevant) applySwap(roster, s.student_a, s.student_b);
  return roster;
}

export function getDutyMembers(cycle: number, index: number, swaps: ReadonlyArray<CycleSwap>): DutyMember[] {
  const eff = getEffectiveRoster(cycle, swaps)[index];
  return eff.map((studentNo, pos) => {
    const base = BASE_ROSTER[index][pos];
    return { studentNo, swappedWith: base !== studentNo ? base : null };
  });
}

/* ------------------------------------------------------------------ */
/* Snapshot (everything the UI needs)                                  */
/* ------------------------------------------------------------------ */

export const STUDENT_COUNT = 27;

export function buildSnapshot(
  today: string,
  cfg: EngineConfig,
  holidays: HolidayMap,
  swaps: ReadonlyArray<CycleSwap>,
): Snapshot {
  const info = getDayInfo(today, cfg, holidays);

  // Reference = a working day with a known step (today if working, otherwise the next working day).
  const refDate = info.isWorking ? today : nextWorkingDay(today, holidays);
  const refStep = info.step;

  const entryForStep = (step: number, date: string): ScheduleEntry => {
    const cycle = cycleOfStep(step);
    const index = indexOfStep(step);
    return { date, cycle, index, members: getDutyMembers(cycle, index, swaps) };
  };

  // Next up + forecast: next 5 working days strictly after today.
  const forecast: ScheduleEntry[] = [];
  let d = today;
  let step = info.isWorking ? info.step : info.step - 1; // step of "the last duty day"
  for (let i = 0; i < 5; i++) {
    d = nextWorkingDay(d, holidays);
    step += 1;
    forecast.push(entryForStep(step, d));
  }
  const next = forecast[0];

  // Current cycle roster with dates.
  const cycle = info.cycle;
  const cycleStart = (cycle - 1) * CYCLE_LENGTH;
  const roster: RosterRow[] = [];
  for (let i = 0; i < CYCLE_LENGTH; i++) {
    const s = cycleStart + i;
    const date = dateForStep(s, refDate, refStep, holidays);
    roster.push({
      ...entryForStep(s, date),
      isPast: date < today,
      isToday: date === today,
      isCurrent: s === info.step,
    });
  }

  // Per-student schedule.
  const effNow = getEffectiveRoster(cycle, swaps);
  const effNext = getEffectiveRoster(cycle + 1, swaps);
  const students: StudentSchedule[] = [];
  for (let no = 1; no <= STUDENT_COUNT; no++) {
    const cur = findStudent(effNow, no);
    const nxt = findStudent(effNext, no);
    if (!cur || !nxt) continue;
    const currentDate = roster[cur.slot].date;
    const ahead = currentDate >= today;
    const upcomingDate = ahead ? currentDate : dateForStep(cycle * CYCLE_LENGTH + nxt.slot, refDate, refStep, holidays);
    students.push({
      studentNo: no,
      currentIndex: cur.slot,
      currentDate,
      upcomingDate,
      upcomingIndex: ahead ? cur.slot : nxt.slot,
      upcomingCycle: ahead ? cycle : cycle + 1,
      isOnDutyToday: info.isWorking && roster[cur.slot].isToday,
    });
  }

  return {
    today: info,
    todayMembers: info.isWorking ? getDutyMembers(info.cycle, info.index, swaps) : null,
    next,
    forecast,
    roster,
    students,
    headline: { cycle: info.cycle, index: info.index },
  };
}
