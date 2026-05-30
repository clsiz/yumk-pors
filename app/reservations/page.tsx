import { reservations } from "@/lib/reservations";

export default function ReservationsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Reservations</h1>
          <p className="mt-2 text-slate-600">
            Review upcoming rehearsal room bookings and request status.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          New request
        </button>
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-slate-100">
          {reservations.map((reservation) => (
            <article
              key={reservation.id}
              className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr_auto]"
            >
              <div>
                <h2 className="font-semibold text-slate-900">
                  {reservation.band}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Requested by {reservation.requestedBy}
                </p>
              </div>
              <div className="text-sm text-slate-600">
                <p>{reservation.room}</p>
                <p>
                  {reservation.date} · {reservation.time}
                </p>
              </div>
              <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700">
                {reservation.status}
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
