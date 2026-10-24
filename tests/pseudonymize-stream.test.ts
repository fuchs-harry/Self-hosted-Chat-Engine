import { streamText } from "ai";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { describe, expect, it } from "vitest";
import { maskMessages, Pseudonymizer, restoreTransform } from "@/lib/chat/pseudonymize";
import type { ChatMessage } from "@/lib/chat/types";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

/**
 * Runs the real AI SDK streaming pipeline with a scripted model, to prove
 * that what the provider receives is masked and what the user sees is not.
 */
describe("pseudonymization in the stream", () => {
  it("masks the prompt and restores split placeholders in the answer", async () => {
    const p = new Pseudonymizer();
    const messages: ChatMessage[] = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Antworte an eva.steiner@example.at wegen IBAN AT61 1904 3002 3457 3201" }],
      },
    ];
    const masked = maskMessages(messages, p);

    const model = new MockLanguageModelV4({
      doStream: {
        stream: convertArrayToReadableStream([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Ich schreibe an [EMA" },
          { type: "text-delta", id: "t1", delta: "IL_1] und prüfe [IBAN_1" },
          { type: "text-delta", id: "t1", delta: "]." },
          { type: "text-end", id: "t1" },
          { type: "finish", usage, finishReason: { unified: "stop", raw: "stop" } },
        ]),
      },
    });

    const result = streamText({
      model,
      messages: masked.map((m) => ({ role: "user" as const, content: (m.parts[0] as { text: string }).text })),
      experimental_transform: restoreTransform(p),
    });
    const text = await result.text;

    const sent = JSON.stringify(model.doStreamCalls[0].prompt);
    expect(sent).not.toContain("eva.steiner@example.at");
    expect(sent).not.toContain("AT61");
    expect(sent).toContain("[EMAIL_1]");
    expect(text).toBe("Ich schreibe an eva.steiner@example.at und prüfe AT61 1904 3002 3457 3201.");
  });
});
