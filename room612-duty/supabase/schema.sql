-- =====================================================================
-- ระบบเช็คเวรประจำวัน ห้อง 612 (SK145) — Supabase schema + seed
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- รันซ้ำได้อย่างปลอดภัย (idempotent) — seed ใช้ upsert / on conflict
-- =====================================================================

-- ---------- Tables ----------
create table if not exists public.students (
  student_no int primary key check (student_no between 1 and 99),
  full_name  text not null,
  nickname   text not null
);

create table if not exists public.app_config (
  id            int primary key default 1 check (id = 1),   -- แถวเดียวเท่านั้น
  anchor_date   date not null,
  anchor_step   int  not null,
  manual_offset int  not null default 0,
  updated_at    timestamptz not null default now()
);

create table if not exists public.holidays (
  holiday_date date primary key,
  name         text not null,
  kind         text not null default 'national' check (kind in ('national', 'school', 'special')),
  created_at   timestamptz not null default now()
);

create table if not exists public.cycle_swaps (
  id           int generated always as identity primary key,
  cycle_number int  not null,
  student_a    int  not null references public.students(student_no),
  student_b    int  not null references public.students(student_no),
  slot_a_index int  not null check (slot_a_index between 0 and 13),
  slot_b_index int  not null check (slot_b_index between 0 and 13),
  note         text,
  created_at   timestamptz not null default now(),
  check (student_a <> student_b)
);
create index if not exists cycle_swaps_cycle_idx on public.cycle_swaps (cycle_number);

-- ---------- Row Level Security ----------
-- ทุกคนอ่านได้ (หน้าเว็บสาธารณะใช้ anon key) แต่ "เขียนไม่ได้" ผ่าน anon key
-- การเขียนทำผ่าน Server Action ด้วย service_role key หลังตรวจ ADMIN_PIN เท่านั้น
alter table public.students    enable row level security;
alter table public.app_config  enable row level security;
alter table public.holidays    enable row level security;
alter table public.cycle_swaps enable row level security;

drop policy if exists "public read students"    on public.students;
drop policy if exists "public read app_config"  on public.app_config;
drop policy if exists "public read holidays"    on public.holidays;
drop policy if exists "public read cycle_swaps" on public.cycle_swaps;

create policy "public read students"    on public.students    for select to anon, authenticated using (true);
create policy "public read app_config"  on public.app_config  for select to anon, authenticated using (true);
create policy "public read holidays"    on public.holidays    for select to anon, authenticated using (true);
create policy "public read cycle_swaps" on public.cycle_swaps for select to anon, authenticated using (true);

-- ---------- Atomic manual-offset shift ----------
create or replace function public.shift_manual_offset(delta int)
returns int
language sql
as $$
  update public.app_config
     set manual_offset = manual_offset + delta,
         updated_at    = now()
   where id = 1
  returning manual_offset;
$$;

-- สำคัญ: ฟังก์ชันใน schema public เรียกผ่าน REST ได้โดย anon เป็นค่าเริ่มต้น → ถอนสิทธิ์
revoke all on function public.shift_manual_offset(int) from public, anon, authenticated;
grant execute on function public.shift_manual_offset(int) to service_role;

-- ---------- Realtime (ให้หน้าเว็บรีเฟรชเองเมื่อ Admin แก้ข้อมูล) ----------
do $$
begin
  begin alter publication supabase_realtime add table public.app_config;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.holidays;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cycle_swaps; exception when duplicate_object then null; end;
end $$;

-- ---------- Seed: config ----------
insert into public.app_config (id, anchor_date, anchor_step, manual_offset)
values (1, '2026-10-27', 1, 0)
on conflict (id) do nothing;   -- ไม่ทับค่าเดิมถ้ารันซ้ำ

-- ---------- Seed: students (27 คน) ----------
insert into public.students (student_no, full_name, nickname) values
  (1,  'วรปรัชญ์ ปิ่นประไพ',            'กาก้า'),
  (2,  'พลาธิป เหมือนแท้',              'โต้'),
  (3,  'ปัณณทัต โฮมไชยะวงศ์',           'ต้น'),
  (4,  'นพัศ อลงกรณ์รัศมี',             'ข้าวปั้น'),
  (5,  'เอกวิวัฒน์ธนกุล วันจันทร์',     'วิน'),
  (6,  'อภิวิชญ์ ปิ่นแก้ว',             'ภูมิ'),
  (7,  'ปฐมกร บรรเลง',                  'ข้าวปั้น'),
  (8,  'กฤติน พันธุมณี',                'เบน'),
  (9,  'กัณตณัฐ เลี้ยงเจริญทรัพย์',     'โมก'),
  (10, 'รัชพล สุธีพิเชฐภัณฑ์',          'พอตเตอร์'),
  (11, 'ธรรม วิธีเจริญ',                'หัมมี่'),
  (12, 'ธัญเทพ อิงบารมี',               'ปลาย'),
  (13, 'กรธัช พิชิตผจงกิจ',             'กังหัน'),
  (14, 'ถิระวิท อุ้ยไพบูลย์สวัสดิ์',    'อะตอม'),
  (15, 'ศิวัช พรพศวัต',                 'ภีม'),
  (16, 'ถิรคุณ ขันธ์เครือ',             'เจด้า'),
  (17, 'พิรภพ ลือพรมมาศ',               'ไกด์'),
  (18, 'พลพงศพัศ สหมิตรมงคล',           'บอมเบ'),
  (19, 'พันธวัสส์ รุจิธรรมธัช',         'โต้'),
  (20, 'ทศวร คำวัตร์',                  'เท็น'),
  (21, 'วรกร วิรามวิทวัส',              'มิก'),
  (22, 'กันต์ธัช เทพอำนวยสกุล',         'ปุณ'),
  (23, 'พีรทรรศ จุฑามาตยางกูร',         'หาม'),
  (24, 'ภทร เกิดเจริญ',                 'หลุยส์'),
  (25, 'ธันยธร อชรางกูร',               'ป๋อ'),
  (26, 'ธนากฤต เงินสว่าง',              'โฟน'),
  (27, 'ภูมิพัชร เพ็ชร์กิจ',            'เวีย')
on conflict (student_no) do update
  set full_name = excluded.full_name,
      nickname  = excluded.nickname;

-- ---------- Seed: วันหยุดราชการไทย ----------
-- ตรวจสอบกับแหล่งข่าวเมื่อ 27 ต.ค. 2569 (ปี 2569: ครม./ปฏิทินวันหยุด, ปี 2570: ประกาศ ธปท. 37/2569)
-- ใส่เฉพาะ "วันธรรมดา (จ.-ศ.)" ที่ยังไม่ถึง เพราะเสาร์-อาทิตย์ระบบข้ามอยู่แล้ว
-- ยังไม่ใส่ (รอประกาศ ครม./สำนักพระราชวัง): วันพืชมงคล 2570, ชดเชยวันอาสาฬหบูชา 20 ก.ค. 2570,
-- ชดเชยวันแรงงาน 3 พ.ค. 2570 (เป็นวันหยุดธนาคาร/เอกชน — โรงเรียนอาจไม่หยุด)
-- >>> วันหยุดของโรงเรียน (ปิดเทอม, สอบ, กีฬาสี ฯลฯ) ต้องเพิ่มเองใน Admin <<<
insert into public.holidays (holiday_date, name, kind) values
  ('2026-12-07', 'ชดเชยวันพ่อแห่งชาติ',                  'national'),
  ('2026-12-10', 'วันรัฐธรรมนูญ',                         'national'),
  ('2026-12-31', 'วันสิ้นปี',                             'national'),
  ('2027-01-01', 'วันขึ้นปีใหม่',                         'national'),
  ('2027-02-22', 'ชดเชยวันมาฆบูชา',                       'national'),
  ('2027-04-06', 'วันจักรี',                              'national'),
  ('2027-04-13', 'วันสงกรานต์',                           'national'),
  ('2027-04-14', 'วันสงกรานต์',                           'national'),
  ('2027-04-15', 'วันสงกรานต์',                           'national'),
  ('2027-05-04', 'วันฉัตรมงคล',                           'national'),
  ('2027-05-20', 'วันวิสาขบูชา',                          'national'),
  ('2027-06-03', 'วันเฉลิมพระชนมพรรษา สมเด็จพระราชินี',   'national'),
  ('2027-07-19', 'วันเข้าพรรษา / ชดเชยวันอาสาฬหบูชา',     'national'),
  ('2027-07-28', 'วันเฉลิมพระชนมพรรษา ร.10',              'national'),
  ('2027-08-12', 'วันแม่แห่งชาติ',                        'national'),
  ('2027-10-13', 'วันนวมินทรมหาราช',                      'national'),
  ('2027-10-25', 'ชดเชยวันปิยมหาราช',                     'national'),
  ('2027-12-06', 'ชดเชยวันพ่อแห่งชาติ',                   'national'),
  ('2027-12-10', 'วันรัฐธรรมนูญ',                         'national'),
  ('2027-12-31', 'วันสิ้นปี',                             'national')
on conflict (holiday_date) do nothing;   -- ไม่ทับวันหยุดที่ Admin แก้ไว้เอง
