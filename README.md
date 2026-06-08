# YUMK-PORS

YUMK-PORS is a graduation project web application for managing rehearsal room
reservations for the Yeditepe University Music Club.

The system manages one rehearsal room. Admins create user accounts, and all
users sign in with a username and password.

This version supports basic reservation request creation, member cancellation
of pending requests, and admin approval, rejection, and cancellation.

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
- `/reservations` authenticated reservation status page
- `/calendar` authenticated calendar page
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
