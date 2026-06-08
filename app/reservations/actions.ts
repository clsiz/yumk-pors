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
import type {
  ApproveReservationRpcResult,
  ReservationRequest,
  ReservationStatus,
} from "@/types/reservation";

const requestColumns =
  "id, user_id, start_time, end_time, purpose, participant_count, equipment_needs, status, admin_note, created_at, updated_at";

function redirectWithMessage(
  type: "notice" | "error",
  message: string,
  redirectPath = "/reservations",
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`${redirectPath}?${params.toString()}`);
}

function getStringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getRedirectPath(formData: FormData) {
  const redirectTo = getStringValue(formData, "redirect_to");

  return redirectTo === "/calendar" ? "/calendar" : "/reservations";
}

function parseParticipantCount(value: string) {
  const count = Number(value);

  if (!Number.isInteger(count) || count < 1) {
    return null;
  }

  return count;
}

async function getReservationRequest(
  requestId: string,
): Promise<{ request: ReservationRequest | null; error: unknown }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservation_requests")
    .select(requestColumns)
    .eq("id", requestId)
    .maybeSingle();

  return {
    request: (data as ReservationRequest | null) ?? null,
    error,
  };
}

async function insertStatusHistory({
  requestId,
  changedBy,
  oldStatus,
  newStatus,
  note,
}: {
  requestId: string;
  changedBy: string;
  oldStatus: ReservationStatus | null;
  newStatus: ReservationStatus;
  note: string | null;
}) {
  const supabase = await createClient();

  return supabase.from("reservation_status_history").insert({
    reservation_request_id: requestId,
    changed_by: changedBy,
    old_status: oldStatus,
    new_status: newStatus,
    note,
  });
}

function getApprovalResult(
  data: ApproveReservationRpcResult | ApproveReservationRpcResult[] | null,
) {
  return Array.isArray(data) ? data[0] : data;
}

function getApprovalErrorMessage(errorMessage?: string) {
  const normalized = errorMessage?.toLowerCase() ?? "";

  if (normalized.includes("not an admin")) {
    return "User is not an admin.";
  }

  if (normalized.includes("not found") || normalized.includes("not pending")) {
    return "Request not found or not pending.";
  }

  if (normalized.includes("already reserved")) {
    return "This slot is already reserved.";
  }

  if (normalized.includes("blocked")) {
    return "This slot is blocked.";
  }

  return "Could not approve the request. Try again.";
}

export async function createReservationRequestAction(formData: FormData) {
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

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  redirectWithMessage("notice", "Reservation request created.");
}

export async function cancelOwnPendingRequestAction(formData: FormData) {
  const { user } = await requireProfile();
  const supabase = await createClient();
  const requestId = getStringValue(formData, "request_id");

  if (!requestId) {
    redirectWithMessage("error", "Reservation request was not found.");
  }

  const { request, error: fetchError } = await getReservationRequest(requestId);

  if (fetchError || !request) {
    redirectWithMessage("error", "Reservation request was not found.");
  }

  if (request.user_id !== user.id || request.status !== "pending") {
    redirectWithMessage("error", "Only your own pending requests can be cancelled.");
  }

  const { error } = await supabase
    .from("reservation_requests")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) {
    redirectWithMessage("error", "Could not cancel the request. Try again.");
  }

  const { error: historyError } = await insertStatusHistory({
    requestId: request.id,
    changedBy: user.id,
    oldStatus: request.status,
    newStatus: "cancelled",
    note: "Cancelled by requester.",
  });

  if (historyError) {
    redirectWithMessage("error", "Request was cancelled, but status history could not be saved.");
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  redirectWithMessage("notice", "Reservation request cancelled.");
}

export async function approveReservationRequestAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const requestId = getStringValue(formData, "request_id");
  const adminNote = getStringValue(formData, "admin_note");
  const redirectPath = getRedirectPath(formData);

  if (!requestId) {
    redirectWithMessage("error", "Reservation request was not found.", redirectPath);
  }

  const { data, error } = await supabase.rpc(
    "approve_reservation_request_with_auto_reject",
    {
      request_id: requestId,
      admin_note: adminNote || null,
    },
  );

  if (error) {
    redirectWithMessage(
      "error",
      getApprovalErrorMessage(error.message),
      redirectPath,
    );
  }

  const result = getApprovalResult(data as ApproveReservationRpcResult[] | null);
  const autoRejectedCount = result?.auto_rejected_count ?? 0;
  const autoRejectedMessage =
    autoRejectedCount > 0
      ? ` ${autoRejectedCount} overlapping pending ${
          autoRejectedCount === 1 ? "request was" : "requests were"
        } automatically rejected.`
      : "";

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirectWithMessage(
    "notice",
    `Reservation request approved.${autoRejectedMessage}`,
    redirectPath,
  );
}

export async function rejectReservationRequestAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const requestId = getStringValue(formData, "request_id");
  const adminNote = getStringValue(formData, "admin_note");
  const redirectPath = getRedirectPath(formData);
  const { request, error: fetchError } = await getReservationRequest(requestId);

  if (fetchError || !request) {
    redirectWithMessage("error", "Reservation request was not found.", redirectPath);
  }

  if (request.status !== "pending") {
    redirectWithMessage("error", "Only pending requests can be rejected.", redirectPath);
  }

  const { error } = await supabase
    .from("reservation_requests")
    .update({
      status: "rejected",
      admin_note: adminNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "pending");

  if (error) {
    redirectWithMessage("error", "Could not reject the request. Try again.", redirectPath);
  }

  const { error: historyError } = await insertStatusHistory({
    requestId: request.id,
    changedBy: user.id,
    oldStatus: request.status,
    newStatus: "rejected",
    note: adminNote || null,
  });

  if (historyError) {
    redirectWithMessage(
      "error",
      "Request was rejected, but status history could not be saved.",
      redirectPath,
    );
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirectWithMessage("notice", "Reservation request rejected.", redirectPath);
}

export async function cancelApprovedReservationAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const requestId = getStringValue(formData, "request_id");
  const adminNote = getStringValue(formData, "admin_note");
  const redirectPath = getRedirectPath(formData);
  const { request, error: fetchError } = await getReservationRequest(requestId);

  if (fetchError || !request) {
    redirectWithMessage("error", "Reservation request was not found.", redirectPath);
  }

  if (request.status !== "approved") {
    redirectWithMessage(
      "error",
      "Only approved reservations can be cancelled by an admin.",
      redirectPath,
    );
  }

  const { error } = await supabase
    .from("reservation_requests")
    .update({
      status: "cancelled",
      admin_note: adminNote || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "approved");

  if (error) {
    redirectWithMessage(
      "error",
      "Could not cancel the reservation. Try again.",
      redirectPath,
    );
  }

  const { error: historyError } = await insertStatusHistory({
    requestId: request.id,
    changedBy: user.id,
    oldStatus: request.status,
    newStatus: "cancelled",
    note: adminNote || null,
  });

  if (historyError) {
    redirectWithMessage(
      "error",
      "Reservation was cancelled, but status history could not be saved.",
      redirectPath,
    );
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  redirectWithMessage("notice", "Reservation cancelled.", redirectPath);
}
