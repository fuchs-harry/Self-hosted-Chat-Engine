import type { Metadata } from "next";
import { Page } from "@/components/page";
import { requireUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { listMemories } from "@/lib/memory";
import { getSetting } from "@/lib/settings";
import { MemoryPanel, PasswordForm, PrivacyPanel, ProfileForm } from "./panels";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [t, memories, orgMemory] = await Promise.all([
    getT(),
    listMemories(user.id),
    getSetting("memory_enabled"),
  ]);

  return (
    <Page title={t.settings.title} subtitle={t.settings.subtitle} className="max-w-3xl">
      <div className="flex flex-col gap-6">
        <ProfileForm name={user.name} email={user.email} />
        <MemoryPanel
          initial={JSON.parse(JSON.stringify(memories))}
          enabled={user.memory_enabled}
          orgEnabled={orgMemory}
        />
        <PasswordForm />
        <PrivacyPanel />
      </div>
    </Page>
  );
}
