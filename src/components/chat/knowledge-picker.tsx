"use client";

import { BookOpen, Building2, Check, ChevronDown, FolderLock, Layers, Slash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";
import type { KnowledgeOption, KnowledgeScope } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function KnowledgePicker({
  options,
  value,
  onChange,
}: {
  options: KnowledgeOption[];
  value: KnowledgeScope;
  onChange: (scope: KnowledgeScope) => void;
}) {
  const { t } = useI18n();
  if (!options.length) return null;

  const selected = value.scope === "kb" ? options.find((o) => o.id === value.kbId) : null;
  const label =
    value.scope === "all" ? t.knowledge.allKnowledge : selected ? selected.name : t.knowledge.none;
  const active = value.scope !== "none";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg px-2 text-[13px] outline-none hover:bg-muted data-[state=open]:bg-muted",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <BookOpen className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t.knowledge.searchIn}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange({ scope: "none" })}>
          <Check className={value.scope === "none" ? "" : "invisible"} />
          <Slash />
          {t.knowledge.none}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange({ scope: "all" })}>
          <Check className={value.scope === "all" ? "" : "invisible"} />
          <Layers />
          {t.knowledge.allKnowledge}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => onChange({ scope: "kb", kbId: o.id })}>
            <Check className={selected?.id === o.id ? "" : "invisible"} />
            {o.visibility === "org" ? <Building2 /> : <FolderLock />}
            <span className="truncate">{o.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
