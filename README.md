# YUMK-PORS

YUMK-PORS is a graduation project web application for managing rehearsal room
reservations for the Yeditepe University Music Club.

The system manages one rehearsal room. Admins create user accounts, and all
users sign in with a username and password.

This version supports calendar-based reservation request creation, member
cancellation of pending requests, and admin approval, rejection, and
cancellation.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint
- Supabase Auth and database
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and add the Supabase project URL and
anon key:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` starts the local development server.
- `npm run lint` runs ESLint.
- `npm run build` creates a production build.
- `npm start` starts the production server after building.

## Pages

- `/` landing page
- `/login` username login page
- `/dashboard` authenticated dashboard
- `/reservations` authenticated reservation tracking and audit page
- `/calendar` authenticated calendar and slot request page
- `/admin` admin-only page

## Authentication

Users enter only a username and password in the application. Supabase Auth uses
email and password internally, so admin-created Auth users should use the local
internal convention:

```text
username@yumk.local
```

The application normalizes the submitted username by trimming whitespace,
converting to lowercase, removing spaces, and appending `@yumk.local` before
calling Supabase Auth. Do not expose this internal value as a login field.

## Supabase Setup

The project expects a username-based `public.profiles` table:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id),
  username text unique not null,
  full_name text not null,
  email text,
  phone text,
  student_number text,
  department text,
  role text check (role in ('admin', 'member')),
  is_active boolean default true,
  created_at timestamp with time zone default now()
);
```

Admins create users by creating the Supabase Auth user with an internal local
email such as `username@yumk.local`, then creating the matching `profiles` row
with the same `auth.users.id`.

The optional `profiles.email` field is a contact field reserved for future
contact, notification, and account recovery support. It is not used for the
current login flow. Users continue to sign in with username and password only.

## Announcements

Announcements provide a simple way to share rehearsal room updates on the
authenticated dashboard. Admins create announcements from `/admin` and can hide
announcements when they are no longer current. Hidden announcements are retained
for admin review but no longer appear on member dashboards. Email notifications
can be added in a future milestone if needed.

Setup SQL:

```sql
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.announcements enable row level security;

create policy "Authenticated users can view active announcements"
on public.announcements
for select
to authenticated
using (is_active = true);

create policy "Admins can view all announcements"
on public.announcements
for select
to authenticated
using (public.is_admin());

create policy "Admins can create announcements"
on public.announcements
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update announcements"
on public.announcements
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

## Reservation Model

The current scope includes one rehearsal room. Therefore, the initial database
design does not include a separate rooms table. If the system is extended to
support multiple rooms in the future, a rooms table and room relationship can be
added.

Reservation requests use predefined 1-hour slots between 10:00 and 18:00:
10:00-11:00, 11:00-12:00, 12:00-13:00, 13:00-14:00, 14:00-15:00,
15:00-16:00, 16:00-17:00, and 17:00-18:00. Pending requests do not block a
slot. Approved reservations and calendar blocks do block a slot.

Members can have at most 10 active reservation requests. Active means pending
requests plus approved reservations whose `end_time` is in the future. Members
can also request or use at most 2 active slots on the same `Europe/Istanbul`
local calendar date. Rejected and cancelled requests do not count toward these
limits.

The calendar is the primary member request creation surface. Members request a
new rehearsal slot by choosing an available time from `/calendar`, then track
their own requests from `/reservations`. Dashboard gives quick access to the
calendar and current request/reservation status. Admins can inspect
slot-specific pending and approved reservations from the calendar, while
`/reservations` remains the tracking, management, and audit page organized into
pending requests, upcoming approved reservations, and history.

The request form collects required group member information and checkbox-based
equipment selections. Selected equipment labels are stored as readable text in
`equipment_needs`. Users must acknowledge the usage rules before submitting a
request; this acknowledgement is validated in the UI/server action and is not
stored in the database in this version.

The calendar shows a 30-day range starting from today by default. Previous,
today, and next navigation controls move the range in 30-day increments. Admins
can navigate to past ranges to review historical reservation and block state.

The project expects these reservation tables:

```sql
create table public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  group_members_details text not null,
  equipment_needs text,
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.reservation_status_history (
  id uuid primary key default gen_random_uuid(),
  reservation_request_id uuid not null references public.reservation_requests(id),
  changed_by uuid not null references public.profiles(id),
  old_status text check (old_status in ('pending', 'approved', 'rejected', 'cancelled')),
  new_status text not null check (new_status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  created_at timestamp with time zone default now()
);

create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  block_type text not null,
  title text not null,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamp with time zone default now()
);
```

These tables intentionally do not include a separate room relationship in the
current single-room scope.

Development migration from the earlier test schema can use the clean database
path after clearing test reservation data:

```sql
alter table public.reservation_requests
  add column group_members_details text not null;

alter table public.reservation_requests
  drop column purpose;

alter table public.reservation_requests
  drop column participant_count;
```

Calendar availability is exposed through privacy-safe Supabase RPC functions
instead of giving members direct read access to other users' reservation rows.
Keep `reservation_requests` private under RLS and use these functions for the
calendar:

```sql
-- Member-facing availability. Returns anonymous occupied intervals only.
get_member_calendar_availability(
  range_start timestamp with time zone,
  range_end timestamp with time zone
)

-- Expected columns:
-- start_time timestamp with time zone
-- end_time timestamp with time zone
-- slot_status text -- "Reserved" or "Closed"

-- Admin-facing availability. May include request/block display details.
get_admin_calendar_availability(
  range_start timestamp with time zone,
  range_end timestamp with time zone
)

-- Expected columns:
-- start_time timestamp with time zone
-- end_time timestamp with time zone
-- slot_status text -- "Reserved" or "Closed"
-- requester_full_name text
-- requester_username text
-- block_title text

-- Anonymous pending request counts for calendar slots.
get_calendar_pending_request_counts(
  range_start timestamp with time zone,
  range_end timestamp with time zone
)

-- Expected columns:
-- start_time timestamp with time zone
-- end_time timestamp with time zone
-- pending_count integer
```

The member RPC must never return requester names, usernames, phone numbers,
student numbers, request details, equipment needs, or admin notes.
Pending counts are anonymous and may be shown to members for available slots.

Admin approval uses a database RPC so approving one request and automatically
rejecting overlapping pending requests is one atomic business operation:

```sql
approve_reservation_request_with_auto_reject(
  request_id uuid,
  admin_note text
)

-- Expected success columns:
-- approved_request_id uuid
-- auto_rejected_count integer
```

The function should verify `public.is_admin()`, load the selected pending
request, re-check approved reservation and calendar block conflicts, approve
the selected request, reject only other pending requests where
`other.start_time < approved.end_time and other.end_time > approved.start_time`,
and insert `reservation_status_history` rows for the approval and every
automatic rejection. Automatic rejections should use this note:

```text
Automatically rejected because another request was approved for this time slot.
```

The function should raise clear errors that the application can show after
redirecting back to `/calendar` or `/reservations`, including:

- `User is not an admin.`
- `Request not found or not pending.`
- `This slot is already reserved.`
- `This slot is blocked.`

Example setup SQL:

```sql
create or replace function public.approve_reservation_request_with_auto_reject(
  request_id uuid,
  admin_note text default null
)
returns table (
  approved_request_id uuid,
  auto_rejected_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_request public.reservation_requests%rowtype;
  auto_reject_note text :=
    'Automatically rejected because another request was approved for this time slot.';
begin
  if not public.is_admin() then
    raise exception 'User is not an admin.';
  end if;

  select *
    into selected_request
    from public.reservation_requests
   where id = $1
     and status = 'pending'
   for update;

  if not found then
    raise exception 'Request not found or not pending.';
  end if;

  if exists (
    select 1
      from public.reservation_requests existing
     where existing.status = 'approved'
       and existing.id <> selected_request.id
       and existing.start_time < selected_request.end_time
       and existing.end_time > selected_request.start_time
  ) then
    raise exception 'This slot is already reserved.';
  end if;

  if exists (
    select 1
      from public.calendar_blocks calendar_block
     where calendar_block.start_time < selected_request.end_time
       and calendar_block.end_time > selected_request.start_time
  ) then
    raise exception 'This slot is blocked.';
  end if;

  update public.reservation_requests
     set status = 'approved',
         admin_note = $2,
         updated_at = now()
   where id = selected_request.id;

  insert into public.reservation_status_history (
    reservation_request_id,
    changed_by,
    old_status,
    new_status,
    note
  )
  values (
    selected_request.id,
    auth.uid(),
    'pending',
    'approved',
    $2
  );

  with rejected as (
    update public.reservation_requests other
       set status = 'rejected',
           admin_note = auto_reject_note,
           updated_at = now()
     where other.status = 'pending'
       and other.id <> selected_request.id
       and other.start_time < selected_request.end_time
       and other.end_time > selected_request.start_time
     returning other.id
  ),
  history as (
    insert into public.reservation_status_history (
      reservation_request_id,
      changed_by,
      old_status,
      new_status,
      note
    )
    select
      rejected.id,
      auth.uid(),
      'pending',
      'rejected',
      auto_reject_note
      from rejected
    returning reservation_request_id
  )
  select count(*)::integer
    into auto_rejected_count
    from history;

  approved_request_id := selected_request.id;
  return next;
end;
$$;
```

Admins can also create and remove calendar blocks from `/calendar`. A
single-slot block closes one available 1-hour slot. A full-day block closes all
8 predefined slots from 10:00 to 18:00 on the selected local calendar date.
Reserved slots must be cancelled before they can be blocked. Removing a block
does not restore pending requests that were previously automatically rejected.
Members see `Closed` plus the block title and optional description, but never
see reservation, requester, or internal admin details.

Block creation also uses database RPCs because creating block rows,
auto-rejecting overlapping pending requests, and writing status history must be
one atomic business operation:

```sql
create_calendar_block_with_auto_reject(
  block_start timestamp with time zone,
  block_end timestamp with time zone,
  block_title text,
  block_description text,
  block_type text
)

create_full_day_calendar_blocks_with_auto_reject(
  block_date date,
  block_title text,
  block_description text,
  block_type text
)

-- Expected success columns for both functions:
-- created_block_count integer
-- auto_rejected_count integer
```

Both functions should verify `public.is_admin()`, reject conflicts with
approved reservations or existing blocks, reject only overlapping pending
requests, and insert `reservation_status_history` rows for automatic
rejections. Automatic rejections should use this note:

```text
Automatically rejected because this slot was blocked by an admin.
```

The full-day function must generate the 8 slots for the selected local
`block_date` in `Europe/Istanbul`, not by UTC date parsing.

Example setup SQL:

```sql
create or replace function public.create_calendar_block_with_auto_reject(
  block_start timestamp with time zone,
  block_end timestamp with time zone,
  block_title text,
  block_description text default null,
  block_type text default 'manual'
)
returns table (
  created_block_count integer,
  auto_rejected_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  local_start timestamp;
  auto_reject_note text :=
    'Automatically rejected because this slot was blocked by an admin.';
begin
  if not public.is_admin() then
    raise exception 'User is not an admin.';
  end if;

  local_start := timezone('Europe/Istanbul', block_start);

  if block_end <> block_start + interval '1 hour'
     or extract(minute from local_start) <> 0
     or extract(second from local_start) <> 0
     or extract(hour from local_start) < 10
     or extract(hour from local_start) > 17 then
    raise exception 'Invalid slot.';
  end if;

  if exists (
    select 1
      from public.reservation_requests request
     where request.status = 'approved'
       and request.start_time < block_end
       and request.end_time > block_start
  ) then
    raise exception 'This slot is already reserved.';
  end if;

  if exists (
    select 1
      from public.calendar_blocks existing_block
     where existing_block.start_time < block_end
       and existing_block.end_time > block_start
  ) then
    raise exception 'This slot is already blocked.';
  end if;

  insert into public.calendar_blocks (
    start_time,
    end_time,
    block_type,
    title,
    description,
    created_by
  )
  values (
    block_start,
    block_end,
    coalesce(nullif(block_type, ''), 'manual'),
    block_title,
    nullif(block_description, ''),
    auth.uid()
  );

  created_block_count := 1;

  with rejected as (
    update public.reservation_requests request
       set status = 'rejected',
           admin_note = auto_reject_note,
           updated_at = now()
     where request.status = 'pending'
       and request.start_time < block_end
       and request.end_time > block_start
     returning request.id
  ),
  history as (
    insert into public.reservation_status_history (
      reservation_request_id,
      changed_by,
      old_status,
      new_status,
      note
    )
    select
      rejected.id,
      auth.uid(),
      'pending',
      'rejected',
      auto_reject_note
      from rejected
    returning reservation_request_id
  )
  select count(*)::integer
    into auto_rejected_count
    from history;

  return next;
end;
$$;

create or replace function public.create_full_day_calendar_blocks_with_auto_reject(
  block_date date,
  block_title text,
  block_description text default null,
  block_type text default 'manual'
)
returns table (
  created_block_count integer,
  auto_rejected_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_reject_note text :=
    'Automatically rejected because this slot was blocked by an admin.';
begin
  if not public.is_admin() then
    raise exception 'User is not an admin.';
  end if;

  create temporary table temp_calendar_block_slots (
    start_time timestamp with time zone,
    end_time timestamp with time zone
  ) on commit drop;

  insert into temp_calendar_block_slots (start_time, end_time)
  select
    make_timestamptz(
      extract(year from block_date)::integer,
      extract(month from block_date)::integer,
      extract(day from block_date)::integer,
      slot_hour,
      0,
      0,
      'Europe/Istanbul'
    ),
    make_timestamptz(
      extract(year from block_date)::integer,
      extract(month from block_date)::integer,
      extract(day from block_date)::integer,
      slot_hour + 1,
      0,
      0,
      'Europe/Istanbul'
    )
  from generate_series(10, 17) as slot_hour;

  if exists (
    select 1
      from temp_calendar_block_slots slot
      join public.reservation_requests request
        on request.status = 'approved'
       and request.start_time < slot.end_time
       and request.end_time > slot.start_time
  ) then
    raise exception 'This full day contains an approved reservation.';
  end if;

  if exists (
    select 1
      from temp_calendar_block_slots slot
      join public.calendar_blocks existing_block
        on existing_block.start_time < slot.end_time
       and existing_block.end_time > slot.start_time
  ) then
    raise exception 'This full day contains an existing block.';
  end if;

  insert into public.calendar_blocks (
    start_time,
    end_time,
    block_type,
    title,
    description,
    created_by
  )
  select
    slot.start_time,
    slot.end_time,
    coalesce(nullif(block_type, ''), 'manual'),
    block_title,
    nullif(block_description, ''),
    auth.uid()
    from temp_calendar_block_slots slot;

  get diagnostics created_block_count = row_count;

  with rejected as (
    update public.reservation_requests request
       set status = 'rejected',
           admin_note = auto_reject_note,
           updated_at = now()
     where request.status = 'pending'
       and exists (
         select 1
           from temp_calendar_block_slots slot
          where request.start_time < slot.end_time
            and request.end_time > slot.start_time
       )
     returning request.id
  ),
  history as (
    insert into public.reservation_status_history (
      reservation_request_id,
      changed_by,
      old_status,
      new_status,
      note
    )
    select
      rejected.id,
      auth.uid(),
      'pending',
      'rejected',
      auto_reject_note
      from rejected
    returning reservation_request_id
  )
  select count(*)::integer
    into auto_rejected_count
    from history;

  return next;
end;
$$;
```

Members receive safe block explanations through a privacy-safe RPC that returns
only calendar block metadata:

```sql
create or replace function public.get_member_calendar_block_details(
  range_start timestamp with time zone,
  range_end timestamp with time zone
)
returns table (
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  block_title text,
  block_description text
)
language sql
security definer
set search_path = public
as $$
  select
    block.start_time,
    block.end_time,
    block.title as block_title,
    block.description as block_description
  from public.calendar_blocks block
  where block.start_time < range_end
    and block.end_time > range_start
  order by block.start_time;
$$;

grant execute on function public.get_member_calendar_block_details(
  timestamp with time zone,
  timestamp with time zone
) to authenticated;
```

Reservation table fields:

- `reservation_requests`: `id`, `user_id`, `start_time`, `end_time`,
  `group_members_details`, `equipment_needs`, `status`, `admin_note`,
  `created_at`, `updated_at`
- `reservation_status_history`: `id`, `reservation_request_id`, `changed_by`,
  `old_status`, `new_status`, `note`, `created_at`
- `calendar_blocks`: `id`, `start_time`, `end_time`, `block_type`, `title`,
  `description`, `created_by`, `created_at`

## Project Structure

```text
app/
components/
lib/
types/
```
