"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberChips } from "@/components/MemberChip";
import { formatThaiShort, type RosterRow, type StudentSchedule } from "@/lib/roster-engine";
import type { Student } from "@/lib/types";

interface Props {
  cycle: number;
  rows: RosterRow[];
  students: Student[];
  schedules: StudentSchedule[];
}

export function RosterSection({ cycle, rows, students, schedules }: Props) {
  const [query, setQuery] = useState("");

  const studentMap = useMemo(() => Object.fromEntries(students.map((s) => [s.student_no, s])), [students]);
  const scheduleMap = useMemo(() => new Map(schedules.map((s) => [s.studentNo, s])), [schedules]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return students.filter(
      (s) => String(s.student_no) === q || s.nickname.toLowerCase().includes(q) || s.full_name.toLowerCase().includes(q),
    );
  }, [q, students]);
  const matchedNos = useMemo(() => new Set(matches.map((m) => m.student_no)), [matches]);

  const visibleRows = q ? rows.filter((r) => r.members.some((m) => matchedNos.has(m.studentNo))) : rows;

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-600" /> ตารางเวรทั้งรอบ (รอบที่ {cycle})
        </CardTitle>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อเล่น ชื่อจริง หรือเลขที่…"
            aria-label="ค้นหาเพื่อน"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </label>
      </CardHeader>

      <CardContent className="space-y-4">
        {q && (
          <div className="space-y-2">
            {matches.length === 0 && <p className="text-sm text-slate-500">ไม่พบ “{query}”</p>}
            {matches.map((s) => {
              const sch = scheduleMap.get(s.student_no);
              return (
                <div key={s.student_no} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
                  <p className="font-semibold">
                    เลขที่ {s.student_no} • {s.nickname}{" "}
                    <span className="font-normal text-slate-600">({s.full_name})</span>
                  </p>
                  {sch && (
                    <p className="mt-0.5 text-slate-700">
                      {sch.isOnDutyToday
                        ? "วันนี้เป็นเวรของคนนี้"
                        : `เวรครั้งถัดไป ${formatThaiShort(sch.upcomingDate, true)} (รอบที่ ${sch.upcomingCycle} คิวที่ ${sch.upcomingIndex + 1})`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ol className="grid gap-2 lg:grid-cols-2">
          {visibleRows.map((r) => (
            <li
              key={r.index}
              className={[
                "flex items-center gap-3 rounded-2xl border p-3",
                r.isToday || r.isCurrent
                  ? "border-indigo-300 bg-indigo-50"
                  : r.isPast
                    ? "border-slate-100 bg-slate-50 text-slate-400"
                    : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/90 text-sm font-bold text-white">
                {r.index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <MemberChips members={r.members} students={studentMap} />
                <p className="text-xs text-slate-500">{formatThaiShort(r.date, true)}</p>
              </div>
              {r.isToday ? (
                <Badge variant="indigo">วันนี้</Badge>
              ) : r.isCurrent ? (
                <Badge variant="orange">ถัดไป</Badge>
              ) : r.isPast ? (
                <Badge variant="slate">ผ่านแล้ว</Badge>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
