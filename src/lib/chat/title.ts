import "server-only";
import { generateText } from "ai";
import { resolveUtilityModel } from "@/lib/providers/registry";
import { db } from "@/lib/db";
import { heuristicTitle } from "./prompt";

/**
 * Gives a chat a short title after its first exchange. Starts with the
 * user's first words and upgrades to a model-written title when possible.
 */
export async function titleChat(chatId: string, firstUserText: string, answer: string): Promise<void> {
  await db()`UPDATE chats SET title = ${heuristicTitle(firstUserText)} WHERE id = ${chatId} AND title = ''`;

  const utility = await resolveUtilityModel();
  if (!utility) return;
  try {
    const { text } = await generateText({
      model: utility.model,
      instructions:
        "Write a title of at most 6 words for this conversation, in the language of the user's message. Reply with the title only: no quotes, no trailing punctuation.",
      prompt: `User: ${firstUserText.slice(0, 1500)}\n\nAssistant: ${answer.slice(0, 1500)}`,
      maxOutputTokens: 30,
    });
    const title = text.replace(/^["'„“]+|["'“”.]+$/g, "").trim().slice(0, 80);
    if (title) await db()`UPDATE chats SET title = ${title} WHERE id = ${chatId}`;
  } catch (err) {
    console.warn("[title] model title failed:", (err as Error).message);
  }
}
