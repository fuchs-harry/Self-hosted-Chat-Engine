import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { countUsers } from "@/lib/auth/users";
import { getT } from "@/lib/i18n/server";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect("/login");
  const t = await getT();

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="title-sweep text-2xl font-semibold tracking-tight">{t.auth.setupTitle}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.auth.setupSub}</p>
      </div>
      <AuthForm mode="setup" />
    </>
  );
}
