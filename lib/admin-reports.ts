import type { Profile } from "@/types/profile";
import type { CalendarBlock, ReservationRequest } from "@/types/reservation";
import {
  formatReservationTimeRange,
  RESERVATION_TIME_ZONE,
} from "@/lib/reservations";

export type Analytics = {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  approvalRate: string;
  approvedHours: string;
  blockedSlotCount: number;
  totalUsers: number;
  requestedSlots: RankedItem[];
  requestedDays: RankedItem[];
  equipmentUsage: RankedItem[];
  topUsers: RankedItem[];
};

export type RankedItem = {
  label: string;
  value: number;
};

export const profileReportColumns =
  "id, username, full_name, email, phone, student_number, department, role, is_active, created_at";

export const reservationReportColumns =
  "id, user_id, start_time, end_time, group_members_details, equipment_needs, status, admin_note, created_at, updated_at";

export const calendarBlockReportColumns =
  "id, start_time, end_time, block_type, title, description, created_by, created_at";

export function buildAnalytics(
  requests: ReservationRequest[],
  users: Profile[],
  blocks: CalendarBlock[],
): Analytics {
  const pendingCount = countByStatus(requests, "pending");
  const approvedCount = countByStatus(requests, "approved");
  const rejectedCount = countByStatus(requests, "rejected");
  const cancelledCount = countByStatus(requests, "cancelled");
  const approvedHours = requests
    .filter((request) => request.status === "approved")
    .reduce((total, request) => total + getRequestHours(request), 0);
  const approvalRate = requests.length
    ? `${Math.round((approvedCount / requests.length) * 100)}%`
    : "0%";

  return {
    totalRequests: requests.length,
    pendingCount,
    approvedCount,
    rejectedCount,
    cancelledCount,
    approvalRate,
    approvedHours: formatHours(approvedHours),
    blockedSlotCount: blocks.length,
    totalUsers: users.length,
    requestedSlots: rankRequests(requests, getRequestTimeSlot),
    requestedDays: rankRequests(requests, getRequestWeekday),
    equipmentUsage: rankEquipment(requests),
    topUsers: rankTopApprovedUsers(requests, users),
  };
}

export function groupRequestsByUser(requests: ReservationRequest[]) {
  const grouped = new Map<string, ReservationRequest[]>();

  requests.forEach((request) => {
    const current = grouped.get(request.user_id) ?? [];
    current.push(request);
    grouped.set(request.user_id, current);
  });

  grouped.forEach((userRequests) => {
    userRequests.sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );
  });

  return grouped;
}

export function serializeCsv(rows: Array<Array<string | number | null | undefined>>) {
  const body = rows
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  return `\uFEFF${body}\r\n`;
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export function formatCsvDateTime(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(value));
}

export function formatCsvDate(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(value));
}

export function formatCsvTime(value?: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(value));
}

function escapeCsvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, '""');

  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function countByStatus(
  requests: ReservationRequest[],
  status: ReservationRequest["status"],
) {
  return requests.filter((request) => request.status === status).length;
}

function rankRequests(
  requests: ReservationRequest[],
  getLabel: (request: ReservationRequest) => string,
) {
  const counts = new Map<string, number>();

  requests.forEach((request) => {
    const label = getLabel(request);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return rankCounts(counts);
}

function rankEquipment(requests: ReservationRequest[]) {
  const counts = new Map<string, number>();

  requests.forEach((request) => {
    request.equipment_needs
      ?.split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      });
  });

  return rankCounts(counts);
}

function rankTopApprovedUsers(
  requests: ReservationRequest[],
  users: Profile[],
) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const counts = new Map<string, number>();

  requests
    .filter((request) => request.status === "approved")
    .forEach((request) => {
      const user = usersById.get(request.user_id);
      const label = user
        ? `${user.full_name} (${user.username})`
        : "Unknown user";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

  return rankCounts(counts);
}

function rankCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function getRequestTimeSlot(request: ReservationRequest) {
  return formatReservationTimeRange(request.start_time, request.end_time);
}

function getRequestWeekday(request: ReservationRequest) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(request.start_time));
}

function getRequestHours(request: ReservationRequest) {
  const start = new Date(request.start_time).getTime();
  const end = new Date(request.end_time).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  return (end - start) / (1000 * 60 * 60);
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
