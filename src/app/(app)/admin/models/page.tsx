import type { Metadata } from "next";
import { Page } from "@/components/page";
import { getT } from "@/lib/i18n/server";
import { providerViews } from "@/lib/providers/admin";
import { PROVIDERS } from "@/lib/providers/catalog";
import { listModelOptions } from "@/lib/providers/registry";
import { getSettings } from "@/lib/settings";
import { ModelPolicy, ProviderList } from "./provider-forms";

export const metadata: Metadata = { title: "Models" };
export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const [t, views, settings, options] = await Promise.all([
    getT(),
    providerViews(),
    getSettings(),
    listModelOptions(),
  ]);

  return (
    <Page title={t.admin.tabs.models} subtitle={t.admin.models.subtitle}>
      <div className="flex flex-col gap-8">
        <ModelPolicy
          options={options}
          defaultModel={settings.default_model}
          euOnly={settings.eu_only}
        />
        <ProviderList defs={PROVIDERS} views={views} />
      </div>
    </Page>
  );
}
