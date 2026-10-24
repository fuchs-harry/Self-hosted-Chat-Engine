"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { login, setup, type FormState } from "./actions";

export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<FormState, FormData>(
    mode === "login" ? login : setup,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === "setup" && (
        <Field label={t.auth.yourName} htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required maxLength={120} />
        </Field>
      )}
      <Field label={t.auth.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field
        label={t.auth.password}
        htmlFor="password"
        hint={mode === "setup" ? t.auth.passwordHint : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          minLength={mode === "setup" ? 10 : undefined}
          required
        />
      </Field>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="chrome" size="lg" disabled={pending} className="mt-2">
        {pending && <Loader2 className="animate-spin" />}
        {mode === "login" ? t.auth.signIn : t.auth.setupCta}
      </Button>
    </form>
  );
}
