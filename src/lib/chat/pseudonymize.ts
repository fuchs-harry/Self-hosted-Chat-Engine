import "server-only";
import type { StreamTextTransform, ToolSet } from "ai";
import { Pseudonymizer } from "@/lib/pii";
import type { ChatMessage } from "./types";

export { Pseudonymizer };

/** Copies of the messages with personal data in text and tool parts masked. */
export function maskMessages(messages: ChatMessage[], p: Pseudonymizer): ChatMessage[] {
  const maskDeep = (v: unknown): unknown => {
    if (typeof v === "string") return p.mask(v);
    if (Array.isArray(v)) return v.map(maskDeep);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskDeep(x)]));
    }
    return v;
  };
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((part) => {
      if (part.type === "text" || part.type === "reasoning") return { ...part, text: p.mask(part.text) };
      if (part.type.startsWith("tool-")) {
        const t = part as { input?: unknown; output?: unknown };
        return { ...part, input: maskDeep(t.input), output: maskDeep(t.output) } as typeof part;
      }
      return part;
    }),
  }));
}

/**
 * Stream transform that puts the real values back into everything the user
 * sees: text, reasoning, and tool inputs/outputs. Holds back partial
 * placeholders that are split across chunks.
 */
export function restoreTransform<TOOLS extends ToolSet>(p: Pseudonymizer): StreamTextTransform<TOOLS> {
  return () => {
    const restorers = new Map<string, ReturnType<Pseudonymizer["streamRestorer"]>>();
    const restorer = (id: string) => {
      let r = restorers.get(id);
      if (!r) restorers.set(id, (r = p.streamRestorer()));
      return r;
    };

    return new TransformStream({
      transform(part, controller) {
        switch (part.type) {
          case "text-delta":
          case "reasoning-delta": {
            const text = restorer(part.id).push(part.text);
            if (text) controller.enqueue({ ...part, text });
            return;
          }
          case "text-end":
          case "reasoning-end": {
            const rest = restorer(part.id).flush();
            if (rest) {
              controller.enqueue(
                part.type === "text-end"
                  ? { type: "text-delta", id: part.id, text: rest }
                  : { type: "reasoning-delta", id: part.id, text: rest },
              );
            }
            controller.enqueue(part);
            return;
          }
          case "tool-call":
            controller.enqueue({ ...part, input: p.unmaskDeep(part.input) });
            return;
          case "tool-result":
            controller.enqueue({ ...part, output: p.unmaskDeep(part.output) });
            return;
          default:
            controller.enqueue(part);
        }
      },
    });
  };
}
