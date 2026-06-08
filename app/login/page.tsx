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
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-6 py-16">
      <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the username and password provided by an administrator.
        </p>
        <LoginForm pageError={pageError} />
      </div>
    </section>
  );
}
