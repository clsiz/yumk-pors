import type { CalendarSlotSummary } from "@/types/reservation";

export const calendarSlotSummaries: CalendarSlotSummary[] = [
  {
    id: "slot-001",
    label: "Evening rehearsal block",
    date: "2026-06-10",
    time: "18:00 - 20:00",
    status: "reserved",
    statusLabel: "Reserved",
  },
  {
    id: "slot-002",
    label: "Afternoon rehearsal block",
    date: "2026-06-11",
    time: "16:00 - 18:00",
    status: "pending",
    statusLabel: "Pending Requests",
  },
  {
    id: "slot-003",
    label: "Maintenance block",
    date: "2026-06-12",
    time: "12:00 - 14:00",
    status: "closed",
    statusLabel: "Closed",
  },
  {
    id: "slot-004",
    label: "Open rehearsal block",
    date: "2026-06-13",
    time: "14:00 - 16:00",
    status: "available",
    statusLabel: "Available",
  },
];
