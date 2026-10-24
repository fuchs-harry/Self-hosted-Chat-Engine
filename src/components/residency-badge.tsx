"use client";

import { Building2, Globe, ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import type { Residency } from "@/lib/providers/catalog";

const TONE: Record<Residency, BadgeTone> = {
  "on-prem": "success",
  eu: "success",
  "eu-optional": "warning",
  "non-eu": "danger",
};

const ICON = {
  "on-prem": Building2,
  eu: ShieldCheck,
  "eu-optional": ShieldAlert,
  "non-eu": Globe,
} satisfies Record<Residency, unknown>;

export function ResidencyBadge({ residency, className }: { residency: Residency; className?: string }) {
  const { t } = useI18n();
  const Icon = ICON[residency];
  return (
    <Badge tone={TONE[residency]} className={className} title={t.residency[`${residency}-long`]}>
      <Icon className="size-3" />
      {t.residency[residency]}
    </Badge>
  );
}
