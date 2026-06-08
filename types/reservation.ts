export type CalendarSlotStatus =
  | "available"
  | "reserved"
  | "pending"
  | "closed";

export type CalendarSlotSummary = {
  id: string;
  label: string;
  date: string;
  time: string;
  status: CalendarSlotStatus;
  statusLabel: "Available" | "Reserved" | "Pending Requests" | "Closed";
};

export type ReservationRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type ReservationRequest = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  purpose: string;
  participant_count: number;
  equipment_needs: string | null;
  status: ReservationRequestStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationStatusHistory = {
  id: string;
  reservation_request_id: string;
  changed_by: string;
  old_status: ReservationRequestStatus | null;
  new_status: ReservationRequestStatus;
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
