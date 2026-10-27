import Link from "next/link";
import { AlertTriangle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HeroCard } from "@/components/HeroCard";
import { Forecast } from "@/components/Forecast";
import { RosterSection } from "@/components/RosterSection";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { computeView, loadRosterData, type View } from "@/lib/data";
import { getPublicClient } from "@/lib/supabase-server";
import { CYCLE_LENGTH, formatThaiDate } from "@/lib/roster-engine";

export const dynamic = "force-dynamic";

async function load(): Promise<{ view: View } | { error: string }> {
  try {
    return { view: computeView(await loadRosterData(getPublicClient())) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" };
  }
}

export default async function HomePage() {
  const result = await load();

  if ("error" in result) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Card className="border-rose-200">
          <CardContent className="space-y-2 pt-6">
            <div className="flex items-center gap-2 font-semibold text-rose-700">
              <AlertTriangle className="h-5 w-5" /> โหลดข้อมูลเวรไม่สำเร็จ
            </div>
            <p className="text-sm text-slate-700">{result.error}</p>
            <p className="text-xs text-slate-500">ตรวจ environment variables บน Vercel และตรวจว่ารัน supabase/schema.sql แล้ว</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { view } = result;
  const { snapshot, data } = view;
  const { today } = snapshot;
  const students = Object.fromEntries(data.students.map((s) => [s.student_no, s]));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
      <RealtimeRefresher />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-700">เวรประจำวัน • ห้อง 612 (SK145)</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{formatThaiDate(today.date)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cycle ที่ {today.cycle} • {today.isWorking ? "คิวที่" : "คิวถัดไป"} {today.index + 1}/{CYCLE_LENGTH}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {today.isWorking ? (
            <Badge variant="green" className="px-3 py-1 text-sm">● วันเรียนปกติ</Badge>
          ) : (
            <Badge variant="orange" className="px-3 py-1 text-sm">● วันหยุด - ไม่มีเวร</Badge>
          )}
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: CYCLE_LENGTH }, (_, i) => (
              <span
                key={i}
                className={[
                  "h-1.5 w-4 rounded-full",
                  i < today.index ? "bg-indigo-300" : i === today.index ? (today.isWorking ? "bg-indigo-600" : "bg-amber-500") : "bg-slate-200",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroCard today={today} members={snapshot.todayMembers} next={snapshot.next} students={students} />
        </div>
        <div className="lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <Forecast entries={snapshot.forecast} students={students} />
        </div>
        <div className="lg:col-span-2">
          <RosterSection cycle={today.cycle} rows={snapshot.roster} students={data.students} schedules={snapshot.students} />
        </div>
      </div>

      <footer className="flex items-center justify-between pt-2 text-xs text-slate-400">
        <span>🔄 = สลับเวรเฉพาะรอบนี้ • คิวไม่เดินในวันหยุด</span>
        <Link href="/admin" className="inline-flex items-center gap-1 hover:text-slate-600">
          <Lock className="h-3 w-3" /> Admin
        </Link>
      </footer>
    </main>
  );
}
