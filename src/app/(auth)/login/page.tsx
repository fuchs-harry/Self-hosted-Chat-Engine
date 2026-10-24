import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { countUsers } from "@/lib/auth/users";
import { getT } from "@/lib/i18n/server";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage() {
  if ((await countUsers()) === 0) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const t = await getT();

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.welcome}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.auth.welcomeSub}</p>
      </div>
      <AuthForm mode="login" />
    </>
  );
}
