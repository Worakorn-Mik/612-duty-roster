import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BASE_ROSTER,
  buildHolidayMap,
  buildSnapshot,
  addDays,
  dateForStep,
  formatThaiDate,
  getDayInfo,
  getDutyMembers,
  getEffectiveRoster,
  isWorkingDay,
  msUntilBangkokMidnight,
  nextWorkingDay,
  stepOf,
  todayInBangkok,
  type CycleSwap,
  type EngineConfig,
} from "./roster-engine";

const CFG: EngineConfig = { anchorDate: "2026-10-27", anchorStep: 1, manualOffset: 0 };
const NO_HOL = buildHolidayMap([]);
const hol = (...dates: string[]) => buildHolidayMap(dates.map((d) => ({ holiday_date: d, name: "test" })));
const nos = (m: { studentNo: number }[]) => m.map((x) => x.studentNo);

const swap = (id: number, cycle: number, a: number, b: number, at = "2026-10-27T10:00:00Z"): CycleSwap => ({
  id, cycle_number: cycle, student_a: a, student_b: b, slot_a_index: 0, slot_b_index: 0, note: null, created_at: at,
});

test("base roster covers students 1..27 exactly once", () => {
  const all = BASE_ROSTER.flat().sort((a, b) => a - b);
  assert.deepEqual(all, Array.from({ length: 27 }, (_, i) => i + 1));
  assert.equal(BASE_ROSTER.length, 14);
});

test("anchor date 2026-10-27 (Tuesday) is cycle 1, index 1 = [14, 2]", () => {
  const info = getDayInfo("2026-10-27", CFG, NO_HOL);
  assert.equal(info.isWorking, true);
  assert.equal(info.step, 1);
  assert.equal(info.cycle, 1);
  assert.equal(info.index, 1);
  assert.deepEqual(nos(getDutyMembers(1, 1, [])), [14, 2]);
});

test("weekend does not consume a queue; Monday continues", () => {
  // Fri 30 Oct = index 4? Tue=1, Wed=2, Thu=3, Fri=4
  assert.equal(getDayInfo("2026-10-30", CFG, NO_HOL).index, 4);
  const sat = getDayInfo("2026-10-31", CFG, NO_HOL);
  const sun = getDayInfo("2026-11-01", CFG, NO_HOL);
  assert.equal(sat.isWorking, false);
  assert.equal(sat.nonWorkingReason, "weekend");
  assert.equal(sat.index, 5); // next-up queue
  assert.equal(sun.index, 5);
  assert.equal(getDayInfo("2026-11-02", CFG, NO_HOL).index, 5); // Monday
});

test("cycle wraps: step 13 = index 13 solo [18], step 14 = cycle 2 index 0", () => {
  const thu = getDayInfo("2026-11-12", CFG, NO_HOL);
  assert.equal(thu.cycle, 1);
  assert.equal(thu.index, 13);
  assert.deepEqual(nos(getDutyMembers(1, 13, [])), [18]);
  const fri = getDayInfo("2026-11-13", CFG, NO_HOL);
  assert.equal(fri.cycle, 2);
  assert.equal(fri.index, 0);
  assert.deepEqual(nos(getDutyMembers(2, 0, [])), [8, 26]);
});

test("holiday is skipped without losing a queue", () => {
  const h = hol("2026-10-29"); // Thursday
  assert.equal(getDayInfo("2026-10-28", CFG, h).index, 2);
  const holiday = getDayInfo("2026-10-29", CFG, h);
  assert.equal(holiday.isWorking, false);
  assert.equal(holiday.nonWorkingReason, "holiday");
  assert.equal(holiday.index, 3); // next-up
  assert.equal(getDayInfo("2026-10-30", CFG, h).index, 3);
  assert.equal(getDayInfo("2026-11-02", CFG, h).index, 4);
});

test("holiday on the anchor date itself: next working day gets the anchor step", () => {
  const h = hol("2026-10-27");
  assert.equal(getDayInfo("2026-10-27", CFG, h).isWorking, false);
  assert.equal(getDayInfo("2026-10-27", CFG, h).index, 1); // next-up = queue index 1
  assert.equal(getDayInfo("2026-10-28", CFG, h).index, 1);
  assert.equal(getDayInfo("2026-10-29", CFG, h).index, 2);
});

test("manual offset shifts the queue", () => {
  assert.equal(getDayInfo("2026-10-27", { ...CFG, manualOffset: 1 }, NO_HOL).index, 2);
  assert.equal(getDayInfo("2026-10-27", { ...CFG, manualOffset: -1 }, NO_HOL).index, 0);
  const wrapBack = getDayInfo("2026-10-27", { ...CFG, manualOffset: -2 }, NO_HOL);
  assert.equal(wrapBack.index, 13); // negative modulo handled
  assert.equal(wrapBack.cycle, 0);
});

test("dates before the anchor are consistent (step decreases by one per working day)", () => {
  assert.equal(stepOf("2026-10-26", CFG, NO_HOL), 0); // Monday
  assert.equal(getDayInfo("2026-10-26", CFG, NO_HOL).index, 0);
  assert.equal(stepOf("2026-10-23", CFG, NO_HOL), -1); // Friday
  assert.equal(getDayInfo("2026-10-23", CFG, NO_HOL).index, 13);
  // with 23 Oct as a holiday it is skipped
  assert.equal(stepOf("2026-10-22", CFG, hol("2026-10-23")), -1);
});

test("swap applies only to its own cycle and shows badge info", () => {
  const swaps = [swap(1, 1, 8, 2)];
  const c1 = getEffectiveRoster(1, swaps);
  assert.deepEqual(c1[0], [2, 26]);
  assert.deepEqual(c1[1], [14, 8]);
  const c2 = getEffectiveRoster(2, swaps);
  assert.deepEqual(c2, BASE_ROSTER.map((s) => [...s])); // next cycle back to default
  const m = getDutyMembers(1, 1, swaps);
  assert.deepEqual(m, [
    { studentNo: 14, swappedWith: null },
    { studentNo: 8, swappedWith: 2 },
  ]);
});

test("swap with the solo slot (student 18) works", () => {
  const eff = getEffectiveRoster(1, [swap(1, 1, 18, 1)]);
  assert.deepEqual(eff[12], [15, 18]);
  assert.deepEqual(eff[13], [1]);
});

test("chained swaps replay in creation order; invalid swaps are ignored", () => {
  const swaps = [
    swap(2, 1, 8, 14, "2026-10-28T00:00:00Z"),
    swap(1, 1, 8, 2, "2026-10-27T00:00:00Z"),
    swap(3, 1, 99, 1), // unknown student -> ignored
    swap(4, 1, 5, 5), // same student -> ignored
  ];
  const eff = getEffectiveRoster(1, swaps);
  // 8<->2 first: [2,26] [14,8]; then 8<->14: [2,26] [8,14]
  assert.deepEqual(eff[0], [2, 26]);
  assert.deepEqual(eff[1], [8, 14]);
  assert.equal(eff.flat().length, 27);
});

test("dateForStep walks forward and backward over weekends/holidays", () => {
  const h = hol("2026-10-29");
  // ref: Tue 27 Oct = step 1
  assert.equal(dateForStep(1, "2026-10-27", 1, h), "2026-10-27");
  assert.equal(dateForStep(2, "2026-10-27", 1, h), "2026-10-28");
  assert.equal(dateForStep(3, "2026-10-27", 1, h), "2026-10-30"); // skips holiday
  assert.equal(dateForStep(5, "2026-10-27", 1, h), "2026-11-03"); // skips weekend
  assert.equal(dateForStep(0, "2026-10-27", 1, h), "2026-10-26");
  assert.equal(dateForStep(-1, "2026-10-27", 1, h), "2026-10-23");
});

test("brute-force simulation matches closed-form engine (random holidays, offsets, dates)", () => {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let trial = 0; trial < 40; trial++) {
    const hs: string[] = [];
    for (let i = 0; i < 25; i++) hs.push(addDays("2026-10-20", Math.floor(rnd() * 400)));
    const h = hol(...hs);
    const offset = Math.floor(rnd() * 9) - 4;
    const cfg: EngineConfig = { ...CFG, manualOffset: offset };
    // simulate forward from the first working day on/after the anchor
    let step = cfg.anchorStep + offset;
    let d = CFG.anchorDate;
    if (!isWorkingDay(d, h)) d = nextWorkingDay(d, h);
    for (let i = 0; i < 330; i++) {
      const info = getDayInfo(d, cfg, h);
      assert.equal(info.isWorking, true);
      assert.equal(info.step, step, `step mismatch on ${d}`);
      assert.equal(info.index, ((step % 14) + 14) % 14);
      // every non-working day in between reports the next duty step
      let gap = addDays(d, 1);
      const nd = nextWorkingDay(d, h);
      while (gap < nd) {
        assert.equal(getDayInfo(gap, cfg, h).step, step + 1, `gap ${gap}`);
        gap = addDays(gap, 1);
      }
      d = nd;
      step += 1;
    }
  }
});

test("snapshot: today working / weekend / forecast / roster / students", () => {
  const swaps = [swap(1, 1, 8, 2)];
  // Tuesday (anchor)
  const s = buildSnapshot("2026-10-27", CFG, NO_HOL, swaps);
  assert.equal(s.today.index, 1);
  assert.deepEqual(nos(s.todayMembers!), [14, 8]);
  assert.equal(s.todayMembers![1].swappedWith, 2);
  assert.equal(s.forecast.length, 5);
  assert.equal(s.next.date, "2026-10-28");
  assert.deepEqual(s.forecast.map((f) => f.date), ["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03"]);
  assert.deepEqual(s.forecast.map((f) => f.index), [2, 3, 4, 5, 6]);
  assert.equal(s.roster.length, 14);
  assert.equal(s.roster[1].date, "2026-10-27");
  assert.equal(s.roster[1].isToday, true);
  assert.equal(s.roster[0].date, "2026-10-26");
  assert.equal(s.roster[0].isPast, true);
  assert.equal(s.roster[13].date, "2026-11-12");
  assert.equal(s.students.length, 27);
  const st8 = s.students.find((x) => x.studentNo === 8)!;
  assert.equal(st8.currentIndex, 1); // swapped into queue 2
  assert.equal(st8.isOnDutyToday, true);
  const st26 = s.students.find((x) => x.studentNo === 26)!;
  assert.equal(st26.currentDate, "2026-10-26"); // past -> upcoming is next cycle
  assert.equal(st26.upcomingCycle, 2);
  assert.equal(st26.upcomingDate, "2026-11-13");
  // Saturday
  const sat = buildSnapshot("2026-10-31", CFG, NO_HOL, []);
  assert.equal(sat.today.isWorking, false);
  assert.equal(sat.todayMembers, null);
  assert.equal(sat.next.date, "2026-11-02");
  assert.equal(sat.next.index, 5);
  assert.equal(sat.roster.find((r) => r.isCurrent)!.index, 5);
  assert.equal(sat.roster.find((r) => r.isToday), undefined);
  // forecast crosses into the next cycle with default order (no swaps leak)
  const late = buildSnapshot("2026-11-12", CFG, NO_HOL, swaps);
  assert.equal(late.next.cycle, 2);
  assert.equal(late.next.index, 0);
  assert.deepEqual(nos(late.next.members), [8, 26]);
});

test("timezone: Bangkok calendar day rolls over at 00:00 +07:00", () => {
  assert.equal(todayInBangkok(new Date("2026-10-27T16:59:59Z")), "2026-10-27"); // 23:59:59 BKK
  assert.equal(todayInBangkok(new Date("2026-10-27T17:00:00Z")), "2026-10-28"); // 00:00:00 BKK
  assert.equal(todayInBangkok(new Date("2026-10-27T10:26:00Z")), "2026-10-27");
  assert.equal(msUntilBangkokMidnight(Date.parse("2026-10-27T16:59:59Z")), 1000);
  assert.equal(msUntilBangkokMidnight(Date.parse("2026-10-27T17:00:00Z")), 86_400_000);
});

test("Thai date formatting", () => {
  assert.equal(formatThaiDate("2026-10-27"), "วันอังคารที่ 27 ตุลาคม 2569");
  assert.equal(formatThaiDate("2026-12-07"), "วันจันทร์ที่ 7 ธันวาคม 2569");
});
