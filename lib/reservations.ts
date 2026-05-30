import type { Reservation } from "@/types/reservation";

export const reservations: Reservation[] = [
  {
    id: "res-001",
    band: "Monday Jazz Ensemble",
    requestedBy: "Aylin Demir",
    room: "Main rehearsal room",
    date: "2026-06-01",
    time: "18:00 - 20:00",
    status: "approved",
  },
  {
    id: "res-002",
    band: "Acoustic Project",
    requestedBy: "Can Arslan",
    room: "Acoustic practice room",
    date: "2026-06-02",
    time: "16:00 - 18:00",
    status: "pending",
  },
  {
    id: "res-003",
    band: "Rock Workshop",
    requestedBy: "Ece Kaya",
    room: "Main rehearsal room",
    date: "2026-06-04",
    time: "19:00 - 21:00",
    status: "approved",
  },
];
