export type ReservationStatus = "pending" | "approved" | "declined";

export type Reservation = {
  id: string;
  band: string;
  requestedBy: string;
  room: string;
  date: string;
  time: string;
  status: ReservationStatus;
};
