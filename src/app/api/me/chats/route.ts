import { apiUser, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { deleteAllChats } from "@/lib/privacy";

/** Deletes all of the user's chats (and their generated files). */
export const DELETE = route(async () => {
  const user = await apiUser();
  const n = await deleteAllChats(user.id);
  await audit("chat.delete", { userId: user.id, detail: { all: true, count: n } });
  return Response.json({ deleted: n });
});
