import type { Metadata } from "next";
import { AdminLogin } from "@/components/AdminLogin";
import { AdminPanel } from "@/components/AdminPanel";
import { isAdmin } from "@/lib/admin-auth";
import { computeView, loadRosterData } from "@/lib/data";
import { getAdminClient } from "@/lib/supabase-server";
import { formatThaiDate, formatThaiShort, todayInBangkok } from "@/lib/roster-engine";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin • เวรห้อง 612",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  let view;
  try {
    view = computeView(await loadRosterData(getAdminClient()));
  } catch (e) {
    return (
      <main className="mx-auto max-w-xl p-6 text-sm text-rose-700">
        โหลดข้อมูลไม่สำเร็จ: {e instanceof Error ? e.message : "ไม่ทราบสาเหตุ"}
      </main>
    );
  }

  const { snapshot, data, today } = view;
  const swaps = data.swaps
    .filter((s) => s.cycle_number === snapshot.today.cycle)
    .map((s) => ({
      id: s.id,
      studentA: s.student_a,
      studentB: s.student_b,
      note: s.note,
      createdLabel: formatThaiShort(todayInBangkok(new Date(s.created_at)), true),
    }));

  return (
    <AdminPanel
      today={today}
      todayLabel={formatThaiDate(today)}
      isWorking={snapshot.today.isWorking}
      cycle={snapshot.today.cycle}
      index={snapshot.today.index}
      manualOffset={data.config.manual_offset}
      students={data.students}
      rows={snapshot.roster}
      swaps={swaps}
      holidays={data.holidays}
    />
  );
}
