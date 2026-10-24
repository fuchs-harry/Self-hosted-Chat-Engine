"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";

export function KnowledgeBaseActions({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <Button variant="ghost" onClick={() => setConfirm(true)}>
        <Trash2 />
        {t.knowledge.deleteKb}
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{t.knowledge.deleteKb}?</DialogTitle>
          <DialogDescription>{t.knowledge.deleteKbBody}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
                router.push("/knowledge");
                router.refresh();
              }}
            >
              {t.common.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
