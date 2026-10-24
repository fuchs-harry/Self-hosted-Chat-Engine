import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";
import { requireUser } from "@/lib/auth/session";
import { chatPageData } from "@/lib/chat/page-data";
import { getChat, loadMessages } from "@/lib/chat/store";

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

  const [messages, data] = await Promise.all([loadMessages(chat.id), chatPageData(user, chat)]);

  return (
    <ChatView
      key={chat.id}
      id={chat.id}
      isNew={false}
      initialMessages={messages}
      {...data}
      user={{ name: user.name, role: user.role }}
    />
  );
}
