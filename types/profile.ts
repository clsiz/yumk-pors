export type UserRole = "admin" | "member";

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  email?: string | null;
  phone: string | null;
  student_number: string | null;
  department: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};
