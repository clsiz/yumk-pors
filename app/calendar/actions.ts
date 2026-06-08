"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import {
  getReservationSlotRange,
  hasApprovedReservationConflict,
  hasCalendarBlockConflict,
  isOneHourRange,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

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
