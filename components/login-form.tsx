"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm({ pageError }: { pageError?: string }) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );
  const error = state.error ?? pageError;

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Username</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          required
          placeholder="username"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Password"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isPending ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
