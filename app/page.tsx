import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";

export default async function LandingPage() {
  const { profile } = await getAuthContext();

  if (profile) {
    redirect("/dashboard");
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center px-4 py-16 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          YUMK-PORS rehearsal room reservations
        </h1>
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
    </section>
  );
}
