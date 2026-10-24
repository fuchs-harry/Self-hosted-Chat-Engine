"use client";

import { Check, ChevronDown, Cpu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResidencyBadge } from "@/components/residency-badge";
import { useI18n } from "@/components/i18n-provider";
import type { ModelOption } from "@/lib/providers/registry";

export function ModelPicker({
  options,
  value,
  onChange,
}: {
  options: ModelOption[];
  value: string | null;
  onChange: (key: string) => void;
}) {
  const { t } = useI18n();
  const current = options.find((o) => o.key === value) ?? options[0];
  if (!current) return null;

  const groups = new Map<string, ModelOption[]>();
  for (const o of options) groups.set(o.providerName, [...(groups.get(o.providerName) ?? []), o]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-8 max-w-[260px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground outline-none hover:bg-muted hover:text-foreground data-[state=open]:bg-muted">
        <Cpu className="size-3.5 shrink-0" />
        <span className="truncate">{current.label}</span>
        <ResidencyBadge residency={current.residency} className="hidden sm:inline-flex" />
        <ChevronDown className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {[...groups.entries()].map(([provider, models]) => (
          <div key={provider}>
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>{provider}</span>
              <ResidencyBadge residency={models[0].residency} />
            </DropdownMenuLabel>
            {models.map((m) => (
              <DropdownMenuItem key={m.key} onSelect={() => onChange(m.key)}>
                <Check className={m.key === current.key ? "" : "invisible"} />
                <span className="flex-1 truncate">{m.label}</span>
                {m.recommended && (
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    {t.chat.recommended}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
