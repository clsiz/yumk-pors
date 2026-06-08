import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";

export type AuthContext = {
  user: User | null;
  profile: Profile | null;
  reason?: "inactive" | "profile";
};

const profileColumns =
  "id, username, full_name, phone, student_number, department, role, is_active, created_at";

export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) {
    return { user, profile: null, reason: "profile" };
  }

  if (profile.is_active === false) {
    return { user, profile: null, reason: "inactive" };
  }

  return { user, profile };
}

export async function requireProfile() {
  const context = await getAuthContext();

  if (!context.user) {
    redirect("/login");
  }

  if (!context.profile) {
    redirect(`/login?error=${context.reason ?? "profile"}`);
  }

  return {
    user: context.user,
    profile: context.profile,
  };
}

export async function requireAdmin() {
  const context = await requireProfile();

  if (context.profile.role !== "admin") {
    redirect("/dashboard");
  }

  return context;
}
