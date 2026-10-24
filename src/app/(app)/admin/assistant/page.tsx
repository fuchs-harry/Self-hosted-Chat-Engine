import type { Metadata } from "next";
import { Page } from "@/components/page";
import { getT } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "../settings-form";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const a = t.admin.assistant;
  return (
    <Page title={t.admin.tabs.assistant} subtitle={a.subtitle} className="max-w-3xl">
      <SettingsForm
        initial={{
          company_profile: settings.company_profile,
          assistant_instructions: settings.assistant_instructions,
        }}
        fields={[
          { key: "company_profile", kind: "text", label: a.profile, hint: a.profileHint, placeholder: a.profilePlaceholder, rows: 8 },
          {
            key: "assistant_instructions",
            kind: "text",
            label: a.instructions,
            hint: a.instructionsHint,
            placeholder: a.instructionsPlaceholder,
            rows: 8,
          },
        ]}
      />
    </Page>
  );
}
