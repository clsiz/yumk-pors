import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAuthContext } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  inactive: "This account is not active. Contact an administrator.",
  profile: "This account is missing a profile. Contact an administrator.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { profile } = await getAuthContext();

  if (profile) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : {};
  const pageError = params.error ? errorMessages[params.error] : undefined;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-bold text-ink">Sign in</h1>
        <LoginForm pageError={pageError} />
      </div>
    </section>
  );
}
