"use server";

import { redirect } from "next/navigation";
import { usernameToAuthEmail } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, "");

  if (!normalizedUsername || !password) {
    return { error: "Enter your username and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password,
  });

  if (error) {
    return { error: "Invalid username or password." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unable to verify this account." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, full_name, email, phone, student_number, department, role, is_active, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut();
    return { error: "This account is not active. Contact an administrator." };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
