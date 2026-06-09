"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type {
  ApproveReservationRpcResult,
  ReservationRequest,
  ReservationStatus,
} from "@/types/reservation";

const requestColumns =
  "id, user_id, start_time, end_time, group_members_details, equipment_needs, status, admin_note, created_at, updated_at";

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
