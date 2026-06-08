import { requireAdmin } from "@/lib/auth/session";
import { calendarSlotSummaries } from "@/lib/reservations";

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  const pendingSlots = calendarSlotSummaries.filter(
    (slot) => slot.status === "pending",
  );

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          Admin access
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Admin</h1>
        <p className="mt-2 text-slate-600">
          Manage users and review reservation requests for {profile.full_name}.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Pending requests</h2>
          <div className="mt-4 space-y-4">
            {pendingSlots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-md border border-slate-200 p-4"
              >
                <p className="font-medium text-slate-900">{slot.label}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {slot.date} - {slot.time}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  Approval actions will be added with reservation workflows.
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">User administration</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Admin-created users will use username, full name, phone number,
            student number, department, role, and password fields in a later
            milestone.
          </p>
          <div className="mt-5 rounded-md border border-slate-200 p-4">
            <p className="font-medium text-slate-900">Roles</p>
            <p className="mt-1 text-sm text-slate-500">admin, member</p>
          </div>
        </div>
      </div>
    </section>
  );
}
