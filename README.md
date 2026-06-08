# YUMK-PORS

YUMK-PORS is a graduation project web application for managing rehearsal room
reservations for the Yeditepe University Music Club.

The system manages one rehearsal room. Admins create user accounts, and all
users sign in with a username and password.

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

## Reservation Model

The current scope includes one rehearsal room. Therefore, the initial database
design does not include a separate rooms table. If the system is extended to
support multiple rooms in the future, a rooms table and room relationship can be
added.

Future reservation tables are planned as:

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
