"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireProfile } from "@/lib/auth/session";
import {
  getReservationSlotRange,
  hasApprovedReservationConflict,
  hasCalendarBlockConflict,
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

function parseParticipantCount(value: string) {
  const count = Number(value);

  if (!Number.isInteger(count) || count < 1) {
    return null;
  }

  return count;
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
  const purpose = getStringValue(formData, "purpose");
  const equipmentNeeds = getStringValue(formData, "equipment_needs");
  const participantCount = parseParticipantCount(
    getStringValue(formData, "participant_count"),
  );
  const range = getReservationSlotRange(date, slot);

  if (!range || !isOneHourRange(range)) {
    redirectWithMessage("error", "Select a valid one-hour slot between 10:00 and 18:00.");
  }

  if (new Date(range.endTime) <= new Date(range.startTime)) {
    redirectWithMessage("error", "The selected reservation time is not valid.");
  }

  if (!purpose) {
    redirectWithMessage("error", "Enter a purpose for the reservation request.");
  }

  if (participantCount === null) {
    redirectWithMessage("error", "Participant count must be at least 1.");
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
    purpose,
    participant_count: participantCount,
    equipment_needs: equipmentNeeds || null,
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
