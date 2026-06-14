import {
  calendarBlockReportColumns,
  csvResponse,
  formatCsvDate,
  formatCsvDateTime,
  formatCsvTime,
  profileReportColumns,
  reservationReportColumns,
  serializeCsv,
} from "@/lib/admin-reports";
import { requireAdmin } from "@/lib/auth/session";
import {
  CALENDAR_RANGE_DAYS,
  getCalendarDates,
  getLocalDateString,
  getReservationSlotRange,
  hasOverlap,
  RESERVATION_SLOTS,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import type { CalendarBlock, ReservationRequest } from "@/types/reservation";

const calendarExportHeaders = [
  "Date",
  "Start Time",
  "End Time",
  "Status",
  "Requester Full Name",
  "Username",
  "Student Number",
  "Department",
  "Equipment Needs",
  "Group Members Details",
  "Admin Note",
  "Block Title",
  "Block Description",
  "Created At",
];

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const dates = getCalendarDates(CALENDAR_RANGE_DAYS, getLocalDateString(new Date()));
  const firstRange = getReservationSlotRange(dates[0], RESERVATION_SLOTS[0]);
  const lastRange = getReservationSlotRange(
    dates[dates.length - 1],
    RESERVATION_SLOTS[RESERVATION_SLOTS.length - 1],
  );

  if (!firstRange || !lastRange) {
    return new Response("Could not build export date range.", { status: 500 });
  }

  const [
    { data: requestData, error: requestsError },
    { data: blockData, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("reservation_requests")
      .select(reservationReportColumns)
      .eq("status", "approved")
      .lt("start_time", lastRange.endTime)
      .gt("end_time", firstRange.startTime)
      .order("start_time", { ascending: true }),
    supabase
      .from("calendar_blocks")
      .select(calendarBlockReportColumns)
      .lt("start_time", lastRange.endTime)
      .gt("end_time", firstRange.startTime)
      .order("start_time", { ascending: true }),
  ]);

  if (requestsError || blocksError) {
    return new Response("Could not export calendar data.", { status: 500 });
  }

  const requests = (requestData ?? []) as ReservationRequest[];
  const blocks = (blockData ?? []) as CalendarBlock[];
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
    calendarExportHeaders,
    ...dates.flatMap((date) =>
      RESERVATION_SLOTS.map((slot) => {
        const range = getReservationSlotRange(date, slot);

        if (!range) {
          return [
            date,
            slot,
            "",
            "Available",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ];
        }

        const block = blocks.find((calendarBlock) =>
          hasOverlap(
            range.startTime,
            range.endTime,
            calendarBlock.start_time,
            calendarBlock.end_time,
          ),
        );

        if (block) {
          return [
            formatCsvDate(range.startTime),
            formatCsvTime(range.startTime),
            formatCsvTime(range.endTime),
            "Closed",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            block.title,
            block.description ?? "",
            formatCsvDateTime(block.created_at),
          ];
        }

        const request = requests.find((reservationRequest) =>
          hasOverlap(
            range.startTime,
            range.endTime,
            reservationRequest.start_time,
            reservationRequest.end_time,
          ),
        );

        if (request) {
          const requester = profilesById.get(request.user_id);

          return [
            formatCsvDate(range.startTime),
            formatCsvTime(range.startTime),
            formatCsvTime(range.endTime),
            "Reserved",
            requester?.full_name ?? "",
            requester?.username ?? "",
            requester?.student_number ?? "",
            requester?.department ?? "",
            request.equipment_needs ?? "",
            request.group_members_details,
            request.admin_note ?? "",
            "",
            "",
            formatCsvDateTime(request.created_at),
          ];
        }

        return [
          formatCsvDate(range.startTime),
          formatCsvTime(range.startTime),
          formatCsvTime(range.endTime),
          "Available",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ];
      }),
    ),
  ];

  return csvResponse(serializeCsv(rows), "yumk-pors-calendar-export.csv");
}
