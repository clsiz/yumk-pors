import Link from "next/link";

export default function LandingPage() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          Yeditepe University Music Club
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          YUMK-PORS rehearsal room reservations
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          A focused reservation and usage tracking system for the club rehearsal
          rehearsal room, with member calendar access and admin-managed users.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Sign in
          </Link>
          <Link
            href="/calendar"
            className="rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            View calendar
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Current milestone</h2>
        <div className="mt-5 space-y-4">
          {[
            "Username and password authentication",
            "Admin-created users only",
            "Role-based navigation and protected pages",
            "Single rehearsal room architecture",
          ].map((item) => (
            <div key={item} className="rounded-md bg-slate-50 p-4 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
