import type { SupabaseClient } from "@supabase/supabase-js";
import type { Announcement } from "@/types/announcement";

const announcementColumns =
  "id, title, body, is_active, created_by, created_at, updated_at";

export async function fetchActiveAnnouncements(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("announcements")
    .select(announcementColumns)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return {
    announcements: (data ?? []) as Announcement[],
    error,
  };
}

export async function fetchAllAnnouncements(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("announcements")
    .select(announcementColumns)
    .order("created_at", { ascending: false });

  return {
    announcements: (data ?? []) as Announcement[],
    error,
  };
}
