import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { requireUser } from "@/lib/auth/session";
import { getChat, loadMessages } from "@/lib/chat/store";
import { defaultModelKey, listModelOptions } from "@/lib/providers/registry";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const chat = UUID.test(id) ? await getChat(id, user.id) : null;
  return { title: chat?.title || "Chat" };
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const chat = await getChat(id, user.id);
  if (!chat) notFound();

  const [messages, models, fallback] = await Promise.all([
    loadMessages(chat.id),
    listModelOptions(),
    defaultModelKey(),
  ]);
  const initialModel = models.some((m) => m.key === chat.model_key) ? chat.model_key : fallback;

  return (
    <ChatView
      key={chat.id}
      id={chat.id}
      isNew={false}
      initialMessages={messages}
      models={models}
      initialModel={initialModel}
      user={{ name: user.name, role: user.role }}
    />
  );
}
