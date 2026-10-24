import type { Metadata } from "next";
import { Page } from "@/components/page";
import { getT } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "../settings-form";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const p = t.admin.privacy;
  return (
    <Page title={t.admin.tabs.privacy} subtitle={p.subtitle} className="max-w-3xl">
      <SettingsForm
        initial={{
          pii_masking: settings.pii_masking,
          chat_retention_days: settings.chat_retention_days,
          memory_enabled: settings.memory_enabled,
        }}
        fields={[
          { key: "pii_masking", kind: "bool", label: p.pii, hint: p.piiHint },
          {
            key: "chat_retention_days",
            kind: "number",
            label: p.retention,
            hint: p.retentionHint,
            suffix: p.days,
            min: 0,
            max: 3650,
          },
          { key: "memory_enabled", kind: "bool", label: p.memory, hint: p.memoryHint },
        ]}
      />
    </Page>
  );
}
