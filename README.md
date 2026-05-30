# YUMK-PORS

YUMK-PORS is a graduation project web application for managing rehearsal room reservations for the Yeditepe University Music Club.

This initial scaffold uses Next.js App Router, TypeScript, Tailwind CSS, ESLint, and npm. Supabase and FullCalendar are intentionally not included yet.

## Getting Started

Install dependencies:

```bash
npm install
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

## Initial Pages

- `/` landing page
- `/login` login page
- `/dashboard` dashboard overview
- `/reservations` reservations list
- `/admin` admin overview
- `/calendar` calendar placeholder

## Project Structure

```text
app/
components/
lib/
types/
```

## Environment

Copy `.env.example` to `.env.local` when environment variables are introduced.
