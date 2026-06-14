import {
  buildAnalytics,
  calendarBlockReportColumns,
  csvResponse,
  profileReportColumns,
  reservationReportColumns,
  serializeCsv,
  type Analytics,
  type RankedItem,
} from "@/lib/admin-reports";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import type { CalendarBlock, ReservationRequest } from "@/types/reservation";

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();
  const [
    { data: requestData, error: requestsError },
    { data: profileData, error: profilesError },
    { data: blockData, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("reservation_requests")
      .select(reservationReportColumns)
      .order("start_time", { ascending: false }),
    supabase
      .from("profiles")
      .select(profileReportColumns)
      .order("created_at", { ascending: false }),
    supabase
      .from("calendar_blocks")
      .select(calendarBlockReportColumns)
      .order("start_time", { ascending: false }),
  ]);

  if (requestsError || profilesError || blocksError) {
    return new Response("Could not export analytics data.", { status: 500 });
  }

  const analytics = buildAnalytics(
    (requestData ?? []) as ReservationRequest[],
    (profileData ?? []) as Profile[],
    (blockData ?? []) as CalendarBlock[],
  );

  return csvResponse(
    serializeCsv(buildAnalyticsRows(analytics)),
    "yumk-pors-analytics-export.csv",
  );
}

function buildAnalyticsRows(analytics: Analytics) {
  return [
    ["Section", "Metric", "Value"],
    ["Summary", "Total requests", analytics.totalRequests],
    ["Summary", "Pending count", analytics.pendingCount],
    ["Summary", "Approved count", analytics.approvedCount],
    ["Summary", "Rejected count", analytics.rejectedCount],
    ["Summary", "Cancelled count", analytics.cancelledCount],
    ["Summary", "Approval rate", analytics.approvalRate],
    ["Summary", "Total approved reservation hours", analytics.approvedHours],
    ["Summary", "Blocked slot count", analytics.blockedSlotCount],
    ["Summary", "Total users", analytics.totalUsers],
    [],
    ["Section", "Rank", "Label", "Value"],
    ...rankedRows("Most requested time slots", analytics.requestedSlots),
    ...rankedRows("Most requested days", analytics.requestedDays),
    ...rankedRows("Most used equipment options", analytics.equipmentUsage),
    ...rankedRows("Top users by approved reservations", analytics.topUsers),
  ];
}

function rankedRows(section: string, items: RankedItem[]) {
  if (!items.length) {
    return [[section, "", "No data", ""]];
  }

  return items.map((item, index) => [
    section,
    index + 1,
    item.label,
    item.value,
  ]);
}
