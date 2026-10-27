import { RefreshCw } from "lucide-react";
import type { DutyMember } from "@/lib/roster-engine";
import type { Student } from "@/lib/types";

/** Compact "nickname #no" label used in lists. Number is always shown because nicknames repeat (โต้, ข้าวปั้น). */
export function MemberChips({ members, students }: { members: DutyMember[]; students: Record<number, Student> }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {members.map((m) => {
        const s = students[m.studentNo];
        return (
          <span key={m.studentNo} className="inline-flex items-center gap-1 font-medium">
            {s?.nickname ?? "?"}
            <span className="text-xs font-normal text-slate-500">#{m.studentNo}</span>
            {m.swappedWith !== null && (
              <RefreshCw
                className="h-3 w-3 text-amber-600"
                aria-label={`สลับกับเลขที่ ${m.swappedWith}`}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
