import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/profile";
import type {
  AdminReservationRequest,
  CalendarBlock,
  CalendarSlotSummary,
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

const calendarBlockColumns =
  "id, start_time, end_time, block_type, title, description, created_by, created_at";

const profileColumns =
  "id, username, full_name, email, phone, student_number, department";

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
  return newStart < existingEnd && newEnd > existingStart;
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

  const requests = data as ReservationRequest[];
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

export async function fetchApprovedReservationsForRange(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from("reservation_requests")
    .select(reservationRequestColumns)
    .eq("status", "approved")
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  return {
    requests: (data ?? []) as ReservationRequest[],
    error,
  };
}

export async function fetchCalendarBlocksForRange(
  supabase: SupabaseClient,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from("calendar_blocks")
    .select(calendarBlockColumns)
    .lt("start_time", endTime)
    .gt("end_time", startTime);

  return {
    blocks: (data ?? []) as CalendarBlock[],
    error,
  };
}

export function buildCalendarSlotSummaries(
  dates: string[],
  approvedReservations: ReservationRequest[],
  calendarBlocks: CalendarBlock[],
) {
  return dates.map((date) =>
    RESERVATION_SLOTS.map((slot): CalendarSlotSummary => {
      const range = getReservationSlotRange(date, slot);
      const isClosed = range
        ? calendarBlocks.some((block) =>
            hasOverlap(range.startTime, range.endTime, block.start_time, block.end_time),
          )
        : false;
      const isReserved = range
        ? approvedReservations.some((request) =>
            hasOverlap(
              range.startTime,
              range.endTime,
              request.start_time,
              request.end_time,
            ),
          )
        : false;

      const status = isClosed ? "closed" : isReserved ? "reserved" : "available";
      const statusLabel =
        status === "closed" ? "Closed" : status === "reserved" ? "Reserved" : "Available";

      return {
        id: `${date}-${slot}`,
        date,
        slot,
        time: getSlotLabel(slot),
        status,
        statusLabel,
      };
    }),
  );
}
