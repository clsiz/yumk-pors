import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { getAuthContext } from "@/lib/auth/session";
import { getNavigationItems } from "@/lib/navigation";

export async function SiteHeader() {
  const { profile } = await getAuthContext();
  const navigationItems = getNavigationItems(profile?.role ?? null);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex min-h-16 max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-ink">
          YUMK-PORS
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-ink sm:px-3"
            >
              {item.label}
            </Link>
          ))}
          {profile ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-ink sm:px-3"
              >
                Logout
              </button>
            </form>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
