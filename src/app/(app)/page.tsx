import { randomUUID } from "node:crypto";
import { ChatView } from "@/components/chat/chat-view";
import { requireUser } from "@/lib/auth/session";
import { defaultModelKey, listModelOptions } from "@/lib/providers/registry";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const [{ new: nonce }, models, initialModel] = await Promise.all([
    searchParams,
    listModelOptions(),
    defaultModelKey(),
  ]);
  // A fresh id per visit; the chat row is only created with the first message.
  const id = randomUUID();

  return (
    <ChatView
      key={nonce ?? id}
      id={id}
      isNew
      initialMessages={[]}
      models={models}
      initialModel={initialModel}
      user={{ name: user.name, role: user.role }}
    />
  );
}
