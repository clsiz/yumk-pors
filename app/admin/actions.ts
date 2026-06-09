"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function redirectWithMessage(type: "notice" | "error", message: string): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/admin?${params.toString()}`);
}

function getStringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateAnnouncementViews() {
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createAnnouncementAction(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const title = getStringValue(formData, "title");
  const body = getStringValue(formData, "body");

  if (!title) {
    redirectWithMessage("error", "Enter an announcement title.");
  }

  if (!body) {
    redirectWithMessage("error", "Enter announcement details.");
  }

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    is_active: true,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirectWithMessage("error", "Could not create the announcement. Try again.");
  }

  revalidateAnnouncementViews();
  redirectWithMessage("notice", "Announcement created.");
}

export async function hideAnnouncementAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const announcementId = getStringValue(formData, "announcement_id");

  if (!announcementId) {
    redirectWithMessage("error", "Announcement was not found.");
  }

  const { data, error } = await supabase
    .from("announcements")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", announcementId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirectWithMessage("error", "Could not hide the announcement. Try again.");
  }

  revalidateAnnouncementViews();
  redirectWithMessage("notice", "Announcement hidden.");
}
