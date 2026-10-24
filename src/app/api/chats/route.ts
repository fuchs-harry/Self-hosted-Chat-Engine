import { apiUser, route } from "@/lib/api";
import { createChat, listChats } from "@/lib/chat/store";

export const GET = route(async (req: Request) => {
  const user = await apiUser();
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 200) || undefined;
  return Response.json(await listChats(user.id, q));
});

export const POST = route(async () => {
  const user = await apiUser();
  return Response.json({ id: await createChat(user.id) }, { status: 201 });
});
