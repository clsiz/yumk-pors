import type { NavigationItem } from "@/types/navigation";
import type { UserRole } from "@/types/profile";

const publicNavigationItems: NavigationItem[] = [
  { label: "Login", href: "/login" },
];

const memberNavigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Reservations", href: "/reservations" },
  { label: "Calendar", href: "/calendar" },
];

const adminNavigationItems: NavigationItem[] = [
  ...memberNavigationItems,
  { label: "Admin", href: "/admin" },
];

export function getNavigationItems(role: UserRole | null): NavigationItem[] {
  if (role === "admin") {
    return adminNavigationItems;
  }

  if (role === "member") {
    return memberNavigationItems;
  }

  return publicNavigationItems;
}
