# ระบบเช็คเวรประจำวัน ห้อง 612 (SK145)

Next.js (App Router) + TypeScript + Tailwind + Supabase — Deploy บน Vercel

เปิดดูบนมือถือว่าวันนี้เวรใคร คิวถัดไปคือใคร + Admin (`/admin`) สำหรับเลื่อนคิว, สลับเวรเฉพาะรอบ, จัดการวันหยุด

## โครงสร้างโปรเจกต์

```
app/
  layout.tsx, globals.css
  page.tsx                  หน้าบ้าน (Hero / Next Up / ตารางทั้งรอบ)
  admin/page.tsx            หน้า Admin (PIN)
  admin/actions.ts          Server Actions ทั้งหมด (login, shift, swap, holiday)
components/
  HeroCard, Forecast, RosterSection, RealtimeRefresher, MemberChip
  AdminLogin, AdminPanel
  ui/ (button, card, badge — สไตล์ shadcn/ui)
lib/
  roster-engine.ts          ลอจิกคิว/รอบ/วันทำการ/สลับเวร (pure functions)
  roster-engine.test.ts     เทสต์ 16 ข้อ (รวม brute-force เทียบการจำลองทีละวัน)
  admin-auth.ts             PIN + คุกกี้ session แบบเซ็น HMAC
  supabase-server.ts, data.ts, types.ts, utils.ts
supabase/schema.sql         ตาราง + RLS + seed นักเรียน 27 คน + วันหยุดราชการ
.env.example
```

## 1) ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ https://supabase.com → New project
2. เมนู **SQL Editor → New query** → วางเนื้อหาไฟล์ `supabase/schema.sql` ทั้งไฟล์ → **Run** (รันซ้ำได้ ไม่ทับข้อมูลที่ Admin แก้)
3. **Project Settings → API** คัดลอก 3 ค่า: Project URL, `anon` key, `service_role` key

## 2) รันในเครื่อง

```bash
npm install
cp .env.example .env.local      # แล้วกรอกค่าให้ครบ
npm run test                    # ทดสอบ roster engine
npm run dev                     # http://localhost:3000
```

สร้าง `ADMIN_SESSION_SECRET`: `openssl rand -base64 32`

## 3) Push ขึ้น GitHub

```bash
git init
git add .
git status                      # ตรวจว่าไม่มี .env.local ติดมา (.gitignore กันไว้แล้ว)
git commit -m "feat: room 612 duty roster"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

## 4) Deploy บน Vercel

1. https://vercel.com/new → Import repo → Framework Preset = Next.js (ตรวจเจออัตโนมัติ)
2. **Environment Variables** ใส่ครบ 5 ตัว (ทั้ง Production และ Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`, `ADMIN_SESSION_SECRET`
3. Deploy — ทุกครั้งที่ push เข้า `main` Vercel จะ deploy ใหม่ให้เอง

## 5) เช็กหลัง Deploy

- หน้าแรกขึ้น “วันอังคารที่ 27 ตุลาคม 2569 … เลขที่ 14 อะตอม, เลขที่ 2 โต้” (ถ้าเปิดวันที่ 27 ต.ค. 2569)
- `/admin` ใส่ PIN ได้ → กด “ตั้งวันนี้เป็นวันหยุดพิเศษ” แล้วหน้าแรกในอีกแท็บเปลี่ยนเอง (Realtime) → ลบวันหยุดนั้นออก
- ทดลองสลับเวร 2 คน แล้วยกเลิก

## สิ่งที่ต้องรู้ตอนใช้งานจริง

- **วันหยุดโรงเรียนต้องเพิ่มเอง** (ปิดเทอม, สอบ, กีฬาสี) — ระบบรู้แค่ เสาร์-อาทิตย์ + วันหยุดที่อยู่ในตาราง `holidays` ถ้าไม่ใส่ คิวจะเดินต่อในวันที่โรงเรียนปิดจริง
- seed วันหยุดราชการใส่ถึงสิ้นปี 2570 เฉพาะที่ยืนยันแล้ว ยังไม่ใส่: วันพืชมงคล 2570, ชดเชยอาสาฬหบูชา 20 ก.ค. 2570, ชดเชยวันแรงงาน 3 พ.ค. 2570 (รอประกาศ/เป็นวันหยุดธนาคาร-เอกชน)
- **เพิ่ม/ลบวันหยุดย้อนหลังไม่ได้** (ตั้งใจ): ถ้าแก้อดีต คิวของ “วันนี้” จะเปลี่ยนตาม
- การสลับเวรเลือกได้เฉพาะคนที่ยังไม่ถึงเวรในรอบนี้ (หรือเป็นเวรวันนี้)
- ชื่อเล่นซ้ำ (โต้ = เลขที่ 2 และ 19, ข้าวปั้น = เลขที่ 4 และ 7) → ทุกจุดที่แสดงชื่อเล่นจะมี `#เลขที่` กำกับ
- ปุ่ม +1/-1 ปรับ `manual_offset` ของ **ทุกวัน** ถ้าปรับจนข้ามรอบ รายการสลับของรอบเดิมจะไม่ตามไปด้วย (ผูกกับเลขรอบ)
- ตัวจำกัดการเดา PIN เป็นแบบ in-memory (ต่อ instance) ช่วยได้แค่เบื้องต้น → ตั้ง `ADMIN_PIN` ให้ยาว ≥ 8 ตัวอักษร
- Next 15.5 มี `npm audit` เตือน postcss ที่ฝังใน next (เกิดตอน build กับ CSS ของเราเอง) — แก้ได้โดยอัปเกรดเป็น Next 16 เมื่อพร้อม
