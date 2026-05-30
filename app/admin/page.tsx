import { reservations } from "@/lib/reservations";

export default function AdminPage() {
  const pendingReservations = reservations.filter(
    (reservation) => reservation.status === "pending",
  );

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-ink">Admin</h1>
        <p className="mt-2 text-slate-600">
          Manage reservation requests and rehearsal room availability.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Pending requests</h2>
          <div className="mt-4 space-y-4">
            {pendingReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-md border border-slate-200 p-4"
              >
                <p className="font-medium text-slate-900">{reservation.band}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {reservation.room} · {reservation.date} · {reservation.time}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Room status</h2>
          <div className="mt-4 space-y-4">
            {["Main rehearsal room", "Acoustic practice room"].map((room) => (
              <div
                key={room}
                className="flex items-center justify-between rounded-md border border-slate-200 p-4"
              >
                <span className="font-medium text-slate-900">{room}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  Available
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
