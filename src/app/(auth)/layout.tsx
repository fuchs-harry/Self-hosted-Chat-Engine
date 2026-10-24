import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.09),transparent_65%)]"
      />
      <div className="fade-up relative w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" alt="" className="size-8" />
          <span className="text-lg font-semibold tracking-tight">{env().APP_NAME}</span>
        </div>
        {children}
        <p className="eyebrow mt-8 text-center">{t.auth.hostedHere}</p>
      </div>
    </main>
  );
}
