import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
          Yeditepe University Music Club
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink sm:text-6xl">
          YUMK-PORS rehearsal room reservations
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          A focused reservation system for students and club admins to track
          rehearsal room availability, reservation requests, and room usage.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-md bg-ink px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign in
          </Link>
          <Link
            href="/calendar"
            className="rounded-md border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-ink transition hover:border-slate-500"
          >
            View calendar
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Initial scope</h2>
        <dl className="mt-6 space-y-5">
          <div>
            <dt className="text-sm font-medium text-slate-500">Members</dt>
            <dd className="mt-1 text-base text-slate-900">
              Browse rooms and plan rehearsal times.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Admins</dt>
            <dd className="mt-1 text-base text-slate-900">
              Review pending requests and monitor usage.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Status</dt>
            <dd className="mt-1 text-base text-slate-900">
              App shell ready for future Supabase and calendar integration.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
