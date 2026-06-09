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

## Reservation Model

The current scope includes one rehearsal room. Therefore, the initial database
design does not include a separate rooms table. If the system is extended to
support multiple rooms in the future, a rooms table and room relationship can be
added.

Reservation requests use predefined 1-hour slots between 10:00 and 18:00:
10:00-11:00, 11:00-12:00, 12:00-13:00, 13:00-14:00, 14:00-15:00,
15:00-16:00, 16:00-17:00, and 17:00-18:00. Pending requests do not block a
slot. Approved reservations and calendar blocks do block a slot.

The calendar is the primary member request creation surface. Members request a
new rehearsal slot by choosing an available time from `/calendar`, then track
their own requests from `/reservations`. Dashboard gives quick access to the
calendar and current request/reservation status. Admins can inspect
slot-specific pending and approved reservations from the calendar, while
`/reservations` remains the tracking, management, and audit page organized into
pending requests, upcoming approved reservations, and history.

The project expects these reservation tables:

```sql
create table public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  purpose text not null,
  participant_count integer not null,
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
student numbers, purpose, participant count, equipment needs, or admin notes.
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

Reservation table fields:

- `reservation_requests`: `id`, `user_id`, `start_time`, `end_time`, `purpose`,
  `participant_count`, `equipment_needs`, `status`, `admin_note`, `created_at`,
  `updated_at`
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
