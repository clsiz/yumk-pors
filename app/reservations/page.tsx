import { requireProfile } from "@/lib/auth/session";
import { calendarSlotSummaries } from "@/lib/reservations";

export default async function ReservationsPage() {
  await requireProfile();

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-ink">Reservations</h1>
        <p className="mt-2 text-slate-600">
          Review anonymous slot status for the single rehearsal room.
        </p>
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-slate-100">
          {calendarSlotSummaries.map((slot) => (
            <article
              key={slot.id}
              className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr_auto]"
            >
              <div>
                <h2 className="font-semibold text-slate-900">{slot.label}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Request details are visible only to admins and request owners.
                </p>
              </div>
              <div className="text-sm text-slate-600">
                <p>{slot.date}</p>
                <p>{slot.time}</p>
              </div>
              <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {slot.statusLabel}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
