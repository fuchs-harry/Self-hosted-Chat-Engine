import { randomUUID } from "node:crypto";
import { ChatView } from "@/components/chat/chat-view";
import { requireUser } from "@/lib/auth/session";
import { chatPageData } from "@/lib/chat/page-data";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const [{ new: nonce }, data] = await Promise.all([searchParams, chatPageData(user)]);
  // A fresh id per visit; the chat row is only created with the first message.
  const id = randomUUID();

  return (
    <ChatView
      key={nonce ?? id}
      id={id}
      isNew
      initialMessages={[]}
      {...data}
      user={{ name: user.name, role: user.role }}
    />
  );
}
