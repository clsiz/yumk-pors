import {
  csvResponse,
  formatCsvDateTime,
  profileReportColumns,
  reservationReportColumns,
  serializeCsv,
} from "@/lib/admin-reports";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import type { ReservationRequest } from "@/types/reservation";

const reservationRequestExportHeaders = [
  "Requester Full Name",
  "Username",
  "Phone",
  "Student Number",
  "Department",
  "Email",
  "Start Time",
  "End Time",
  "Status",
  "Equipment Needs",
  "Group Members Details",
  "Admin Note",
  "Created At",
];

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: requestData, error: requestsError } = await supabase
    .from("reservation_requests")
    .select(reservationReportColumns)
    .order("start_time", { ascending: false });

  if (requestsError) {
    return new Response("Could not export reservation request data.", {
      status: 500,
    });
  }

  const requests = (requestData ?? []) as ReservationRequest[];
  const userIds = Array.from(new Set(requests.map((request) => request.user_id)));
  const { data: profileData, error: profilesError } = userIds.length
    ? await supabase
        .from("profiles")
        .select(profileReportColumns)
        .in("id", userIds)
    : { data: [], error: null };

  if (profilesError) {
    return new Response("Could not export requester data.", { status: 500 });
  }

  const profilesById = new Map(
    ((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile]),
  );
  const rows = [
    reservationRequestExportHeaders,
    ...requests.map((request) => {
      const requester = profilesById.get(request.user_id);

      return [
        requester?.full_name ?? "",
        requester?.username ?? "",
        requester?.phone ?? "",
        requester?.student_number ?? "",
        requester?.department ?? "",
        requester?.email ?? "",
        formatCsvDateTime(request.start_time),
        formatCsvDateTime(request.end_time),
        request.status,
        request.equipment_needs ?? "",
        request.group_members_details,
        request.admin_note ?? "",
        formatCsvDateTime(request.created_at),
      ];
    }),
  ];

  return csvResponse(
    serializeCsv(rows),
    "yumk-pors-reservation-requests-export.csv",
  );
}
