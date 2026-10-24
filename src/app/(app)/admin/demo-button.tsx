"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoButton({ label, done }: { label: string; done: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <Button
      variant="chrome-outline"
      size="sm"
      disabled={state !== "idle"}
      onClick={async () => {
        setState("busy");
        const res = await fetch("/api/admin/demo", { method: "POST" });
        const body = (await res.json()) as { id: string };
        setState("done");
        router.push(`/knowledge/${body.id}`);
      }}
    >
      {state === "busy" ? <Loader2 className="animate-spin" /> : state === "done" ? <Check /> : <Sparkles />}
      {state === "done" ? done : label}
    </Button>
  );
}
