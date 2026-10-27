"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  FastForward,
  LogOut,
  Rewind,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDays,
  dayOfWeek,
  formatThaiDate,
  formatThaiShort,
  thaiMonthName,
  type RosterRow,
} from "@/lib/roster-engine";
import type { ActionResult, Holiday, HolidayKind, Student } from "@/lib/types";
import {
  addHoliday,
  createSwap,
  logout,
  removeHoliday,
  revertSwap,
  setTodayHoliday,
  shiftQueue,
} from "@/app/admin/actions";

interface SwapItem {
  id: number;
  studentA: number;
  studentB: number;
  note: string | null;
  createdLabel: string;
}

interface Props {
  today: string;
  todayLabel: string;
  isWorking: boolean;
  cycle: number;
  index: number;
  manualOffset: number;
  students: Student[];
  rows: RosterRow[];
  swaps: SwapItem[];
  holidays: Holiday[];
}

const KIND_LABEL: Record<HolidayKind, string> = {
  national: "วันหยุดราชการ",
  school: "วันหยุดโรงเรียน",
  special: "วันหยุดพิเศษ",
};

export function AdminPanel(props: Props) {
  const { today, todayLabel, isWorking, cycle, index, manualOffset, students, rows, swaps, holidays } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.student_no, s])), [students]);
  const nick = (no: number) => studentMap.get(no)?.nickname ?? "?";

  async function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      if (res.ok) {
        setMsg({ ok: true, text: res.message ?? "บันทึกแล้ว" });
        onOk?.();
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
        // session expired → reload so the login screen appears
        if (res.error.includes("เซสชัน")) router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-indigo-700">Admin • ห้อง 612 (SK145)</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{todayLabel}</h1>
          <p className="text-sm text-slate-600">
            Cycle ที่ {cycle} • {isWorking ? "คิวที่" : "คิวถัดไป"} {index + 1}/14 • offset {manualOffset > 0 ? `+${manualOffset}` : manualOffset}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/")}>
            ดูหน้าเว็บ
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run(() => logout())}
            disabled={busy}
          >
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </Button>
        </div>
      </header>

      {msg && (
        <p
          role="status"
          className={`rounded-xl px-4 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
        >
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ------------ Quick Queue Shift ------------ */}
        <Card>
          <CardHeader>
            <CardTitle>ปรับเลื่อนลำดับเวร (Quick Queue Shift)</CardTitle>
            <p className="text-sm text-slate-500">
              ใช้เมื่อเกิดเหตุฉุกเฉิน — เลื่อนคิวของ “ทุกวัน” ไปข้างหน้า/ถอยหลัง 1 คิว ไม่กระทบประวัติการสลับของรอบเดิมโดยตรง
              แต่ถ้าเลื่อนข้ามรอบ รายการสลับจะผูกกับรอบเดิม
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={busy} onClick={() => run(() => shiftQueue(-1))}>
              <Rewind className="h-4 w-4" /> ถอยคิว (-1)
            </Button>
            <Button disabled={busy} onClick={() => run(() => shiftQueue(1))}>
              เดินหน้าคิว (+1) <FastForward className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* ------------ Holiday quick action ------------ */}
        <Card>
          <CardHeader>
            <CardTitle>ตั้งวันนี้เป็นวันหยุดพิเศษ</CardTitle>
            <p className="text-sm text-slate-500">
              คิวของวันนี้จะเลื่อนไปวันทำการถัดไปทันที โดยไม่เสียคิว
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="warning"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`ตั้ง ${todayLabel} เป็นวันหยุดพิเศษ — ยืนยัน?`)) run(() => setTodayHoliday());
              }}
            >
              <CalendarPlus className="h-4 w-4" /> ตั้งวันนี้เป็นวันหยุดพิเศษ
            </Button>
          </CardContent>
        </Card>
      </div>

      <SwapManager
        busy={busy}
        cycle={cycle}
        students={students}
        rows={rows}
        swaps={swaps}
        nick={nick}
        onCreate={(a, b, note, reset) => run(() => createSwap(a, b, note), reset)}
        onRevert={(id) => {
          if (window.confirm("ยกเลิกการสลับนี้?")) run(() => revertSwap(id));
        }}
      />

      <HolidayManager
        busy={busy}
        today={today}
        holidays={holidays}
        onAdd={(d, n, k, reset) => run(() => addHoliday(d, n, k), reset)}
        onRemove={(d) => run(() => removeHoliday(d))}
      />
    </main>
  );
}

/* ====================================================================== */
/* Swap manager                                                           */
/* ====================================================================== */

function SwapManager(props: {
  busy: boolean;
  cycle: number;
  students: Student[];
  rows: RosterRow[];
  swaps: SwapItem[];
  nick: (no: number) => string;
  onCreate: (a: number, b: number, note: string, reset: () => void) => void;
  onRevert: (id: number) => void;
}) {
  const { busy, cycle, students, rows, swaps, nick, onCreate, onRevert } = props;
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [note, setNote] = useState("");

  // Where each student sits in the current cycle (after existing swaps). Only seats that are not in the past can be swapped.
  const seatOf = useMemo(() => {
    const m = new Map<number, RosterRow>();
    for (const r of rows) for (const mem of r.members) m.set(mem.studentNo, r);
    return m;
  }, [rows]);

  const options = students
    .filter((s) => {
      const r = seatOf.get(s.student_no);
      return r && !r.isPast;
    })
    .map((s) => {
      const r = seatOf.get(s.student_no)!;
      return {
        no: s.student_no,
        label: `${s.student_no}. ${s.nickname} — ${s.full_name} • คิว ${r.index + 1} (${formatThaiShort(r.date)})`,
      };
    });

  const sameSeat = a !== "" && b !== "" && seatOf.get(Number(a))?.index === seatOf.get(Number(b))?.index;
  const canSubmit = a !== "" && b !== "" && a !== b && !sameSeat && !busy;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-indigo-600" /> สลับเวรเฉพาะรอบ (รอบที่ {cycle})
        </CardTitle>
        <p className="text-sm text-slate-500">
          สลับตำแหน่งคิวของ 2 คน มีผลเฉพาะรอบนี้ — เมื่อขึ้นรอบใหม่ตารางกลับเป็นค่าเริ่มต้นอัตโนมัติ (เลือกได้เฉพาะคนที่ยังไม่ถึงเวรหรือเป็นเวรวันนี้)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Select label="นักเรียนคนที่ 1" value={a} onChange={setA} options={options} exclude={b} />
          <Select label="นักเรียนคนที่ 2" value={b} onChange={setB} options={options} exclude={a} />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="หมายเหตุ (ไม่บังคับ) เช่น ไปแข่งขัน"
          className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        {sameSeat && <p className="text-sm text-amber-700">สองคนนี้อยู่คิวเดียวกันอยู่แล้ว ไม่ต้องสลับ</p>}
        <Button
          disabled={!canSubmit}
          onClick={() =>
            onCreate(Number(a), Number(b), note, () => {
              setA("");
              setB("");
              setNote("");
            })
          }
        >
          สลับเวรเฉพาะรอบนี้
        </Button>

        <div>
          <h3 className="mb-2 text-sm font-semibold">รายการที่สลับไว้ในรอบนี้</h3>
          {swaps.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีการสลับ</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {swaps.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      #{s.studentA} {nick(s.studentA)} <ArrowLeftRight className="mx-1 inline h-3 w-3 text-slate-400" /> #{s.studentB}{" "}
                      {nick(s.studentB)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.createdLabel}
                      {s.note ? ` • ${s.note}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onRevert(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> ยกเลิก
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { no: number; label: string }[];
  exclude: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">— เลือก —</option>
        {props.options.map((o) => (
          <option key={o.no} value={String(o.no)} disabled={String(o.no) === props.exclude}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ====================================================================== */
/* Holiday manager (month calendar)                                       */
/* ====================================================================== */

function HolidayManager(props: {
  busy: boolean;
  today: string;
  holidays: Holiday[];
  onAdd: (date: string, name: string, kind: HolidayKind, reset: () => void) => void;
  onRemove: (date: string) => void;
}) {
  const { busy, today, holidays, onAdd, onRemove } = props;
  const [ty, tm] = today.split("-").map(Number);
  const [year, setYear] = useState(ty);
  const [month, setMonth] = useState(tm); // 1..12
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HolidayKind>("school");

  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.holiday_date, h])), [holidays]);

  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lead = dayOfWeek(first); // Sunday-first grid
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];

  function go(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
    setSelected(null);
  }

  const upcoming = holidays.filter((h) => h.holiday_date >= today);
  const selHoliday = selected ? holidayMap.get(selected) : undefined;
  const selPast = selected !== null && selected < today;

  return (
    <Card>
      <CardHeader>
        <CardTitle>จัดการวันหยุด (Holiday Manager)</CardTitle>
        <p className="text-sm text-slate-500">
          กดวันที่เพื่อเพิ่ม/ลบวันหยุด เช่น วันสอบ วันกีฬาสี ปิดเทอม — วันหยุดไม่กินคิว (ย้อนหลังแก้ไม่ได้ เพื่อกันคิวของวันนี้เปลี่ยน)
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => go(-1)} aria-label="เดือนก่อนหน้า">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-semibold">
              {thaiMonthName(month)} {year + 543}
            </p>
            <Button variant="ghost" size="sm" onClick={() => go(1)} aria-label="เดือนถัดไป">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={`b${i}`} />;
              const dow = dayOfWeek(date);
              const weekend = dow === 0 || dow === 6;
              const h = holidayMap.get(date);
              const isToday = date === today;
              const isSel = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={weekend}
                  onClick={() => {
                    setSelected(date);
                    setName("");
                  }}
                  title={h?.name}
                  className={[
                    "aspect-square rounded-xl text-sm transition-colors",
                    weekend ? "cursor-not-allowed text-slate-300" : "hover:bg-indigo-50",
                    h ? "bg-amber-100 font-semibold text-amber-900" : "",
                    isToday ? "ring-2 ring-indigo-500" : "",
                    isSel ? "outline outline-2 outline-offset-1 outline-indigo-600" : "",
                  ].join(" ")}
                >
                  {Number(date.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 p-3">
            {!selected ? (
              <p className="text-sm text-slate-500">เลือกวันที่จากปฏิทิน (เสาร์-อาทิตย์ไม่ต้องตั้ง เพราะข้ามอยู่แล้ว)</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{formatThaiDate(selected)}</p>
                {selHoliday ? (
                  <>
                    <p className="text-sm">
                      เป็นวันหยุด: <b>{selHoliday.name}</b> <Badge variant="slate">{KIND_LABEL[selHoliday.kind]}</Badge>
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy || selPast}
                      onClick={() => onRemove(selected)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> ลบวันหยุดนี้
                    </Button>
                  </>
                ) : (
                  <>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      placeholder="ชื่อวันหยุด เช่น วันสอบกลางภาค"
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                    />
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as HolidayKind)}
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-2 text-sm"
                    >
                      <option value="school">{KIND_LABEL.school}</option>
                      <option value="special">{KIND_LABEL.special}</option>
                      <option value="national">{KIND_LABEL.national}</option>
                    </select>
                    <Button
                      size="sm"
                      disabled={busy || selPast}
                      onClick={() => onAdd(selected, name, kind, () => setName(""))}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> เพิ่มเป็นวันหยุด
                    </Button>
                  </>
                )}
                {selPast && <p className="text-xs text-amber-700">วันที่ผ่านมาแล้วแก้ไม่ได้</p>}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">วันหยุดที่กำลังจะมาถึง ({upcoming.length})</h3>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200">
            {upcoming.length === 0 && <li className="p-3 text-sm text-slate-500">ไม่มีวันหยุดล่วงหน้า</li>}
            {upcoming.map((h) => (
              <li key={h.holiday_date} className="flex items-center justify-between gap-2 p-3 text-sm">
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => {
                    const [y, m] = h.holiday_date.split("-").map(Number);
                    setYear(y);
                    setMonth(m);
                    setSelected(h.holiday_date);
                  }}
                >
                  <p className="font-medium">{formatThaiShort(h.holiday_date, true)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {h.name} • {KIND_LABEL[h.kind]}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => onRemove(h.holiday_date)}
                  aria-label={`ลบ ${h.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
