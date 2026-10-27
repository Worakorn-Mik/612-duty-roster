import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberChips } from "@/components/MemberChip";
import { formatThaiDate, formatThaiShort, type ScheduleEntry } from "@/lib/roster-engine";
import type { Student } from "@/lib/types";

export function Forecast({ entries, students }: { entries: ScheduleEntry[]; students: Record<number, Student> }) {
  const [next, ...rest] = entries;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-indigo-600" /> คิวถัดไป &amp; ล่วงหน้า 5 วันทำการ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="indigo">ถัดไป</Badge>
            <span className="text-xs text-slate-500">
              รอบที่ {next.cycle} • คิวที่ {next.index + 1}/14
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">{formatThaiDate(next.date)}</p>
          <div className="mt-1 text-xl">
            <MemberChips members={next.members} students={students} />
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {rest.map((e) => (
            <li key={e.date} className="flex items-start gap-3 py-2.5">
              <div className="w-20 shrink-0 text-sm font-semibold text-slate-600">{formatThaiShort(e.date)}</div>
              <div className="min-w-0 flex-1 text-sm">
                <MemberChips members={e.members} students={students} />
              </div>
              <span className="shrink-0 text-xs text-slate-400">คิว {e.index + 1}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
