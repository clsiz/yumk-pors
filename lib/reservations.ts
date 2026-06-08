import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/profile";
import type {
  AdminReservationRequest,
  AdminCalendarAvailabilityRow,
  CalendarBlock,
  CalendarPendingCountRow,
  CalendarSlotSummary,
  MemberCalendarAvailabilityRow,
  ReservationRequest,
  ReservationSlot,
} from "@/types/reservation";

export const RESERVATION_SLOTS: ReservationSlot[] = [
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export const RESERVATION_TIME_ZONE = "Europe/Istanbul";
const RESERVATION_TIME_ZONE_OFFSET = "+03:00";

const reservationRequestColumns =
  "id, user_id, start_time, end_time, purpose, participant_count, equipment_needs, status, admin_note, created_at, updated_at";

const profileColumns =
  "id, username, full_name, email, phone, student_number, department";

const calendarBlockColumns =
  "id, start_time, end_time, block_type, title, description, created_by, created_at";

export type SlotRange = {
  startTime: string;
  endTime: string;
};

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export function getSlotLabel(slot: ReservationSlot) {
  const hour = Number(slot.slice(0, 2));
  return `${slot} - ${String(hour + 1).padStart(2, "0")}:00`;
}

export function isReservationSlot(value: string): value is ReservationSlot {
  return RESERVATION_SLOTS.includes(value as ReservationSlot);
}

export function getReservationSlotRange(
  date: string,
  slot: string,
): SlotRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isReservationSlot(slot)) {
    return null;
  }

  const hour = Number(slot.slice(0, 2));
  const start = new Date(
    `${date}T${String(hour).padStart(2, "0")}:00:00${RESERVATION_TIME_ZONE_OFFSET}`,
  );
  const end = new Date(
    `${date}T${String(hour + 1).padStart(2, "0")}:00:00${RESERVATION_TIME_ZONE_OFFSET}`,
  );

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

export function isOneHourRange({ startTime, endTime }: SlotRange) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return end.getTime() - start.getTime() === 60 * 60 * 1000;
}

export function hasOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string,
) {
  const newStartTime = new Date(newStart).getTime();
  const newEndTime = new Date(newEnd).getTime();
  const existingStartTime = new Date(existingStart).getTime();
  const existingEndTime = new Date(existingEnd).getTime();

  if (
    [
      newStartTime,
      newEndTime,
      existingStartTime,
      existingEndTime,
    ].some(Number.isNaN)
  ) {
    return false;
  }

  // Strict overlap: 10:00-11:00 vs 11:00-12:00 is false,
  // 11:00-12:00 vs 11:00-12:00 is true,
  // and 12:00-13:00 vs 11:00-12:00 is false.
  return newStartTime < existingEndTime && newEndTime > existingStartTime;
}

export function formatReservationDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(value));
}

export function formatReservationTimeRange(startTime: string, endTime: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RESERVATION_TIME_ZONE,
  });

  return `${formatter.format(new Date(startTime))} - ${formatter.format(
    new Date(endTime),
  )}`;
}

export function getLocalDateString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: RESERVATION_TIME_ZONE,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function getCalendarDates(dayCount = 7) {
  const dates: string[] = [];
  const now = new Date();

  for (let index = 0; index < dayCount; index += 1) {
    const next = new Date(now);
    next.setDate(now.getDate() + index);
    dates.push(getLocalDateString(next));
  }

  return dates;
}

export async function hasApprovedReservationConflict(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from("reservation_requests")
    .select("id")
    .eq("status", "approved")
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);

  return { hasConflict: Boolean(data?.length), error };
}

export async function hasCalendarBlockConflict(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from("calendar_blocks")
    .select("id")
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .limit(1);

  return { hasConflict: Boolean(data?.length), error };
}

export async function fetchMemberReservationRequests(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("reservation_requests")
    .select(reservationRequestColumns)
    .eq("user_id", userId)
    .order("start_time", { ascending: false });

  return {
    requests: (data ?? []) as ReservationRequest[],
    error,
  };
}

export async function fetchAdminReservationRequests(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("reservation_requests")
    .select(reservationRequestColumns)
    .order("start_time", { ascending: false });

  if (error || !data?.length) {
    return {
      requests: (data ?? []) as AdminReservationRequest[],
      error,
    };
  }

  return attachRequesterProfiles(supabase, data as ReservationRequest[]);
}

async function attachRequesterProfiles(
  supabase: SupabaseClient,
  requests: ReservationRequest[],
) {
  const userIds = Array.from(new Set(requests.map((request) => request.user_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(profileColumns)
    .in("id", userIds);

  if (profilesError) {
    return {
      requests: [],
      error: profilesError,
    };
  }

  const profilesById = new Map(
    ((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]),
  );

  return {
    requests: requests.map((request) => ({
      ...request,
      requester: profilesById.get(request.user_id) ?? null,
    })),
    error: null,
  };
}

export async function fetchAdminCalendarRequestsForRange(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from("reservation_requests")
    .select(reservationRequestColumns)
    .in("status", ["pending", "approved"])
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .order("start_time", { ascending: true });

  if (error || !data?.length) {
    return {
      requests: (data ?? []) as AdminReservationRequest[],
      error,
    };
  }

  return attachRequesterProfiles(supabase, data as ReservationRequest[]);
}

export async function fetchAdminCalendarBlocksForRange(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from("calendar_blocks")
    .select(calendarBlockColumns)
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .order("start_time", { ascending: true });

  return {
    blocks: (data ?? []) as CalendarBlock[],
    error,
  };
}

export async function fetchMemberCalendarAvailability(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .rpc("get_member_calendar_availability", {
      range_start: startTime,
      range_end: endTime,
    });

  return {
    availability: (data ?? []) as MemberCalendarAvailabilityRow[],
    error,
  };
}

export async function fetchAdminCalendarAvailability(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .rpc("get_admin_calendar_availability", {
      range_start: startTime,
      range_end: endTime,
    });

  return {
    availability: (data ?? []) as AdminCalendarAvailabilityRow[],
    error,
  };
}

export async function fetchCalendarPendingRequestCounts(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .rpc("get_calendar_pending_request_counts", {
      range_start: startTime,
      range_end: endTime,
    });

  return {
    pendingCounts: (data ?? []) as CalendarPendingCountRow[],
    error,
  };
}

export function buildCalendarSlotSummaries(
  dates: string[],
  availabilityRows: (
    | MemberCalendarAvailabilityRow
    | AdminCalendarAvailabilityRow
  )[],
  pendingCountRows: CalendarPendingCountRow[] = [],
  options: {
    adminRequests?: AdminReservationRequest[];
    adminBlocks?: CalendarBlock[];
  } = {},
) {
  return dates.map((date) =>
    RESERVATION_SLOTS.map((slot): CalendarSlotSummary => {
      const range = getReservationSlotRange(date, slot);
      const occupiedSlot = range
        ? availabilityRows.find((row) =>
            hasOverlap(
              range.startTime,
              range.endTime,
              row.start_time,
              row.end_time,
            ),
          )
        : undefined;
      const pendingCount = range
        ? pendingCountRows
            .filter((row) =>
              hasOverlap(
                range.startTime,
                range.endTime,
                row.start_time,
                row.end_time,
              ),
            )
            .reduce((total, row) => total + row.pending_count, 0)
        : 0;
      const pendingRequests = range
        ? options.adminRequests?.filter(
            (request) =>
              request.status === "pending" &&
              hasOverlap(
                range.startTime,
                range.endTime,
                request.start_time,
                request.end_time,
              ),
          )
        : undefined;
      const approvedRequest = range
        ? options.adminRequests?.find(
            (request) =>
              request.status === "approved" &&
              hasOverlap(
                range.startTime,
                range.endTime,
                request.start_time,
                request.end_time,
              ),
          )
        : undefined;
      const block = range
        ? options.adminBlocks?.find((calendarBlock) =>
            hasOverlap(
              range.startTime,
              range.endTime,
              calendarBlock.start_time,
              calendarBlock.end_time,
            ),
          )
        : undefined;

      const status = occupiedSlot?.slot_status === "Closed"
        ? "closed"
        : occupiedSlot?.slot_status === "Reserved"
          ? "reserved"
          : "available";
      const statusLabel =
        status === "closed" ? "Closed" : status === "reserved" ? "Reserved" : "Available";
      const adminSlot = occupiedSlot as AdminCalendarAvailabilityRow | undefined;

      return {
        id: `${date}-${slot}`,
        date,
        slot,
        time: getSlotLabel(slot),
        status,
        statusLabel,
        pendingCount,
        reservationRequesterName:
          approvedRequest?.requester?.full_name ??
          adminSlot?.requester_full_name ??
          undefined,
        reservationRequesterUsername:
          approvedRequest?.requester?.username ??
          adminSlot?.requester_username ??
          undefined,
        blockTitle: block?.title ?? adminSlot?.block_title ?? undefined,
        pendingRequests: pendingRequests?.length ? pendingRequests : undefined,
        approvedRequest,
        block,
      };
    }),
  );
}
