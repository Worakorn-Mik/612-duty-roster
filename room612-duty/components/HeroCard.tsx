import { CalendarOff, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MemberChips } from "@/components/MemberChip";
import { formatThaiDate, thaiWeekday, type DayInfo, type DutyMember, type ScheduleEntry } from "@/lib/roster-engine";
import type { Student } from "@/lib/types";

interface Props {
  today: DayInfo;
  members: DutyMember[] | null;
  next: ScheduleEntry;
  students: Record<number, Student>;
}

export function HeroCard({ today, members, next, students }: Props) {
  if (!today.isWorking || !members) {
    const reason =
      today.nonWorkingReason === "holiday" ? (today.holidayName ?? "วันหยุด") : `วัน${thaiWeekday(today.date)} (วันหยุดสุดสัปดาห์)`;
    return (
      <section className="rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/90">
          <CalendarOff className="h-4 w-4" /> วันนี้ไม่มีเวร
        </div>
        <p className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{reason}</p>
        <p className="mt-2 text-white/90">คิวไม่ถูกข้าม — เวรถัดไปคือ {formatThaiDate(next.date)}</p>
        <div className="mt-5 rounded-2xl bg-white/20 p-4 backdrop-blur">
          <p className="text-xs font-semibold text-white/80">คิวที่ {next.index + 1}/14 ถัดไป</p>
          <div className="mt-1 text-lg text-white [&_*]:text-white">
            <MemberChips members={next.members} students={students} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 text-white shadow-lg sm:p-8">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-indigo-100">
        <ClipboardCheck className="h-4 w-4" /> เวรประจำวันนี้
      </div>
      <div className={`mt-5 grid gap-4 ${members.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {members.map((m) => {
          const s = students[m.studentNo];
          return (
            <article key={m.studentNo} className="flex items-center gap-4 rounded-2xl bg-white/15 p-4 backdrop-blur">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-indigo-700">
                <span className="text-[10px] font-semibold leading-none text-indigo-400">เลขที่</span>
                <span className="text-3xl font-extrabold leading-none">{m.studentNo}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-3xl font-extrabold leading-tight sm:text-4xl">{s?.nickname ?? "—"}</p>
                <p className="truncate text-sm text-indigo-100">{s?.full_name ?? ""}</p>
                {m.swappedWith !== null && (
                  <Badge variant="orange" className="mt-2">
                    🔄 สลับเวรเฉพาะรอบนี้กับเลขที่ {m.swappedWith}
                    {students[m.swappedWith] ? ` (${students[m.swappedWith].nickname})` : ""}
                  </Badge>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
