import "server-only";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

/**
 * Deletes chats (with their messages and generated files) that have not
 * been touched for longer than the configured retention period. Storage
 * limitation, GDPR Art. 5(1)(e). 0 days = keep forever.
 */
export async function purgeExpiredChats(): Promise<number> {
  const days = await getSetting("chat_retention_days");
  if (!days || days <= 0) return 0;
  const res = await db()`
    DELETE FROM chats WHERE updated_at < now() - make_interval(days => ${days})`;
  if (res.count) await audit("retention.purge", { detail: { chats: res.count, days } });
  return res.count;
}
