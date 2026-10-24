import { requireAdmin } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { AdminTabs } from "./tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getT();
  return (
    <div className="flex h-full flex-col">
      <AdminTabs labels={t.admin.tabs} />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
