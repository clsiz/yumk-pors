"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireProfile } from "@/lib/auth/session";
import {
  countActiveMemberReservationRequests,
  countMemberDailyActiveSlots,
  RESERVATION_EQUIPMENT_OPTIONS,
  getReservationSlotRange,
  hasApprovedReservationConflict,
  hasCalendarBlockConflict,
  isFutureSlot,
  isOneHourRange,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { CalendarBlockRpcResult } from "@/types/reservation";

function redirectWithMessage(type: "notice" | "error", message: string): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/calendar?${params.toString()}`);
}

function getStringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getSelectedEquipment(formData: FormData) {
  return formData
    .getAll("equipment_needs")
    .map((value) => String(value).trim())
    .filter((value) => RESERVATION_EQUIPMENT_OPTIONS.includes(value));
}

function getRpcResult(
  data: CalendarBlockRpcResult | CalendarBlockRpcResult[] | null,
) {
  return Array.isArray(data) ? data[0] : data;
}

function getBlockErrorMessage(errorMessage?: string) {
  const normalized = errorMessage?.toLowerCase() ?? "";

  if (normalized.includes("not an admin")) {
    return "User is not an admin.";
  }

  if (normalized.includes("approved") || normalized.includes("reserved")) {
    return "This slot is already reserved.";
  }

  if (normalized.includes("existing block") || normalized.includes("blocked")) {
    return "This slot is already blocked.";
  }

  if (normalized.includes("invalid full-day") || normalized.includes("full day")) {
    return "The selected day cannot be blocked.";
  }

  if (normalized.includes("invalid slot") || normalized.includes("allowed hours")) {
    return "Select a valid one-hour slot between 10:00 and 18:00.";
  }

  return "Could not create the calendar block. Try again.";
}

function formatBlockSuccessMessage(result: CalendarBlockRpcResult | null) {
  const createdBlockCount = result?.created_block_count ?? 0;
  const autoRejectedCount = result?.auto_rejected_count ?? 0;
  const blockLabel = createdBlockCount === 1 ? "block" : "blocks";
  const rejectedMessage =
    autoRejectedCount > 0
      ? ` ${autoRejectedCount} overlapping pending ${
          autoRejectedCount === 1 ? "request was" : "requests were"
        } automatically rejected.`
      : "";

  return `${createdBlockCount} calendar ${blockLabel} created.${rejectedMessage}`;
}

function revalidateReservationViews() {
  revalidatePath("/calendar");
  revalidatePath("/reservations");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function createCalendarReservationRequestAction(formData: FormData) {
  const { user } = await requireProfile();
  const supabase = await createClient();
  const date = getStringValue(formData, "date");
  const slot = getStringValue(formData, "slot");
  const groupMembersDetails = getStringValue(formData, "group_members_details");
  const selectedEquipment = getSelectedEquipment(formData);
  const usageRulesAccepted = formData.get("usage_rules") === "accepted";
  const range = getReservationSlotRange(date, slot);

  if (!range || !isOneHourRange(range)) {
    redirectWithMessage("error", "Select a valid one-hour slot between 10:00 and 18:00.");
  }

  if (new Date(range.endTime) <= new Date(range.startTime)) {
    redirectWithMessage("error", "The selected reservation time is not valid.");
  }

  if (!isFutureSlot(range.startTime)) {
    redirectWithMessage("error", "Past slots cannot be requested.");
  }

  if (!groupMembersDetails) {
    redirectWithMessage("error", "Enter group members information.");
  }

  if (!selectedEquipment.length) {
    redirectWithMessage("error", "Select at least one equipment option.");
  }

  if (!usageRulesAccepted) {
    redirectWithMessage("error", "You must agree to the usage rules before submitting.");
  }

  const activeRequestCount = await countActiveMemberReservationRequests(
    supabase,
    user.id,
  );

  if (activeRequestCount.error) {
    redirectWithMessage("error", "Could not check your active requests. Try again.");
  }

  if (activeRequestCount.count >= 10) {
    redirectWithMessage("error", "You can have at most 10 active reservation requests.");
  }

  const dailyActiveSlotCount = await countMemberDailyActiveSlots(
    supabase,
    user.id,
    date,
  );

  if (dailyActiveSlotCount.error) {
    redirectWithMessage("error", "Could not check your daily reservation limit. Try again.");
  }

  if (dailyActiveSlotCount.count >= 2) {
    redirectWithMessage("error", "You can request or use at most 2 hours per day.");
  }

  const approvedConflict = await hasApprovedReservationConflict(
    supabase,
    range.startTime,
    range.endTime,
  );

  if (approvedConflict.error) {
    redirectWithMessage("error", "Could not check approved reservations. Try again.");
  }

  if (approvedConflict.hasConflict) {
    redirectWithMessage("error", "That slot is already reserved.");
  }

  const blockConflict = await hasCalendarBlockConflict(
    supabase,
    range.startTime,
    range.endTime,
  );

  if (blockConflict.error) {
    redirectWithMessage("error", "Could not check calendar blocks. Try again.");
  }

  if (blockConflict.hasConflict) {
    redirectWithMessage("error", "That slot is closed.");
  }

  const { error } = await supabase.from("reservation_requests").insert({
    user_id: user.id,
    start_time: range.startTime,
    end_time: range.endTime,
    group_members_details: groupMembersDetails,
    equipment_needs: selectedEquipment.join("\n"),
    status: "pending",
    admin_note: null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirectWithMessage("error", "Could not create the reservation request. Try again.");
  }

  revalidatePath("/calendar");
  revalidatePath("/reservations");
  redirectWithMessage("notice", "Reservation request created.");
}

export async function createCalendarBlockAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const date = getStringValue(formData, "date");
  const slot = getStringValue(formData, "slot");
  const title = getStringValue(formData, "title");
  const description = getStringValue(formData, "description");
  const blockType = getStringValue(formData, "block_type") || "manual";
  const range = getReservationSlotRange(date, slot);

  if (!range || !isOneHourRange(range)) {
    redirectWithMessage("error", "Select a valid one-hour slot between 10:00 and 18:00.");
  }

  if (!title) {
    redirectWithMessage("error", "Enter a title for the calendar block.");
  }

  const { data, error } = await supabase.rpc(
    "create_calendar_block_with_auto_reject",
    {
      block_start: range.startTime,
      block_end: range.endTime,
      block_title: title,
      block_description: description || null,
      block_type: blockType,
    },
  );

  if (error) {
    redirectWithMessage("error", getBlockErrorMessage(error.message));
  }

  const result = getRpcResult(
    data as CalendarBlockRpcResult | CalendarBlockRpcResult[] | null,
  );

  revalidateReservationViews();
  redirectWithMessage("notice", formatBlockSuccessMessage(result));
}

export async function createFullDayCalendarBlocksAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const date = getStringValue(formData, "date");
  const title = getStringValue(formData, "title");
  const description = getStringValue(formData, "description");
  const blockType = getStringValue(formData, "block_type") || "manual";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirectWithMessage("error", "Select a valid calendar date.");
  }

  if (!title) {
    redirectWithMessage("error", "Enter a title for the calendar block.");
  }

  const { data, error } = await supabase.rpc(
    "create_full_day_calendar_blocks_with_auto_reject",
    {
      block_date: date,
      block_title: title,
      block_description: description || null,
      block_type: blockType,
    },
  );

  if (error) {
    redirectWithMessage("error", getBlockErrorMessage(error.message));
  }

  const result = getRpcResult(
    data as CalendarBlockRpcResult | CalendarBlockRpcResult[] | null,
  );

  revalidateReservationViews();
  redirectWithMessage("notice", formatBlockSuccessMessage(result));
}

export async function deleteCalendarBlockAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const blockId = getStringValue(formData, "block_id");

  if (!blockId) {
    redirectWithMessage("error", "Calendar block was not found.");
  }

  const { data, error } = await supabase
    .from("calendar_blocks")
    .delete()
    .eq("id", blockId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirectWithMessage("error", "Could not remove the calendar block. Try again.");
  }

  revalidateReservationViews();
  redirectWithMessage("notice", "Calendar block removed.");
}
