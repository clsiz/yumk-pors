import type { Profile } from "@/types/profile";

export type CalendarSlotStatus = "available" | "reserved" | "closed";

export type CalendarSlotSummary = {
  id: string;
  date: string;
  slot: ReservationSlot;
  time: string;
  status: CalendarSlotStatus;
  statusLabel: "Available" | "Reserved" | "Closed";
  reservationRequesterName?: string;
  reservationRequesterUsername?: string;
  blockTitle?: string;
};

export type CalendarAvailabilityStatus = "Reserved" | "Closed";

export type MemberCalendarAvailabilityRow = {
  start_time: string;
  end_time: string;
  slot_status: CalendarAvailabilityStatus;
};

export type AdminCalendarAvailabilityRow = MemberCalendarAvailabilityRow & {
  requester_full_name?: string | null;
  requester_username?: string | null;
  block_title?: string | null;
};

export type ReservationSlot =
  | "10:00"
  | "11:00"
  | "12:00"
  | "13:00"
  | "14:00"
  | "15:00"
  | "16:00"
  | "17:00";

export type ReservationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ReservationRequest = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  participant_count: number;
  equipment_needs: string | null;
  status: ReservationStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminReservationRequest = ReservationRequest & {
  requester: Pick<
    Profile,
    | "id"
    | "username"
    | "full_name"
    | "email"
    | "phone"
    | "student_number"
    | "department"
  > | null;
};

export type ReservationStatusHistory = {
  id: string;
  reservation_request_id: string;
  changed_by: string;
  old_status: ReservationStatus | null;
  new_status: ReservationStatus;
  note: string | null;
  created_at: string;
};

export type CalendarBlock = {
  id: string;
  start_time: string;
  end_time: string;
  block_type: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
};
