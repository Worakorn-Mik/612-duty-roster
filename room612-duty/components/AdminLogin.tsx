"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { login } from "@/app/admin/actions";

export function AdminLogin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login(pin);
      if (res.ok) router.refresh();
      else setError(res.error);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
      setPin("");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-indigo-600" /> Admin • ห้อง 612
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="ใส่ PIN ทีมงาน"
              aria-label="PIN"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || pin.length === 0}>
              {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
