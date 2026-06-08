import { requireProfile } from "@/lib/auth/session";
import { calendarSlotSummaries } from "@/lib/reservations";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage() {
  await requireProfile();

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-ink">Calendar</h1>
        <p className="mt-2 text-slate-600">
          Member-facing availability for the single rehearsal room.
        </p>
      </div>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 bg-slate-50 text-center text-sm font-semibold text-slate-600">
          {weekDays.map((day) => (
            <div
              key={day}
              className="border-r border-slate-200 p-3 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid min-h-[28rem] grid-cols-1 divide-y divide-slate-100 md:grid-cols-7 md:divide-x md:divide-y-0">
          {weekDays.map((day, index) => (
            <div key={day} className="p-4">
              <p className="text-sm font-medium text-slate-500">Day {index + 1}</p>
              <div className="mt-4 space-y-3">
                {calendarSlotSummaries
                  .filter((_, slotIndex) => slotIndex === index % 4)
                  .map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-md bg-slate-50 p-3 text-sm text-slate-700"
                    >
                      <p className="font-semibold">{slot.statusLabel}</p>
                      <p className="mt-1">{slot.time}</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
