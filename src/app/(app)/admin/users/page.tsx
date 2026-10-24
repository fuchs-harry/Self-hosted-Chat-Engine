import type { Metadata } from "next";
import { Page } from "@/components/page";
import { requireAdmin } from "@/lib/auth/session";
import { listUsers } from "@/lib/auth/users";
import { getT } from "@/lib/i18n/server";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const [t, users] = await Promise.all([getT(), listUsers()]);
  return (
    <Page title={t.admin.tabs.users} subtitle={t.admin.users.subtitle}>
      <UsersTable initial={JSON.parse(JSON.stringify(users))} meId={me.id} />
    </Page>
  );
}
