import { describe, expect, it } from "vitest";
import { searchQuery } from "@/lib/chat/retrieval";
import type { ChatMessage } from "@/lib/chat/types";
import { chunkPages } from "@/lib/rag/chunk";
import { detectMimeType, isSupported } from "@/lib/rag/extract";
import { toTsQuery } from "@/lib/rag/search";
import { parseMultistatus } from "@/lib/connectors/webdav";

describe("chunker", () => {
  const paragraph = "Der Urlaubsanspruch beträgt 25 Arbeitstage pro Jahr. ".repeat(12);

  it("keeps chunks under the target size and overlapping", () => {
    const chunks = chunkPages([{ page: 1, text: `${paragraph}\n\n${paragraph}\n\n${paragraph}` }], {
      size: 400,
      overlap: 80,
    });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(400);
    // Consecutive chunks share text.
    const tail = chunks[0].content.slice(-30);
    expect(chunks[1].content).toContain(tail.slice(tail.indexOf(" ") + 1, tail.indexOf(" ") + 12));
  });

  it("never mixes pages and keeps page numbers", () => {
    const chunks = chunkPages([
      { page: 1, text: "Seite eins mit Text über Reisekosten und Belege." },
      { page: 2, text: "Seite zwei mit Text über Urlaub und Homeoffice." },
    ]);
    expect(chunks.map((c) => c.page)).toEqual([1, 2]);
  });

  it("keeps a short single document instead of dropping it", () => {
    expect(chunkPages([{ page: null, text: "Kurz." }])).toHaveLength(1);
    expect(chunkPages([{ page: null, text: "   \n  " }])).toHaveLength(0);
  });
});

describe("keyword query", () => {
  it("drops stopwords and builds a prefix OR query", () => {
    expect(toTsQuery("Wie viel Kilometergeld bekomme ich?")).toBe("viel:* | kilometergeld:* | bekomme:*");
    expect(toTsQuery("ist es?")).toBeNull();
  });

  it("adds the previous question to short follow-ups", () => {
    const m = (id: string, role: "user" | "assistant", text: string): ChatMessage => ({
      id,
      role,
      parts: [{ type: "text", text }],
    });
    const messages = [
      m("1", "user", "Wie hoch ist das Taggeld bei Inlandsreisen?"),
      m("2", "assistant", "30 Euro pro Tag."),
      m("3", "user", "Und in Wien?"),
    ];
    expect(searchQuery(messages)).toBe("Wie hoch ist das Taggeld bei Inlandsreisen?\nUnd in Wien?");
  });
});

describe("file types", () => {
  it("detects supported files by extension", () => {
    expect(detectMimeType("Bericht.PDF")).toBe("application/pdf");
    expect(isSupported("notes.md")).toBe(true);
    expect(isSupported("setup.exe")).toBe(false);
  });
});

describe("WebDAV multistatus", () => {
  it("parses Nextcloud-style responses with namespace prefixes", () => {
    const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>/remote.php/dav/files/u/Handbuch/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
  <d:response><d:href>/remote.php/dav/files/u/Handbuch/IT%20Richtlinie.pdf</d:href>
    <d:propstat><d:prop><d:resourcetype/><d:getcontentlength>2048</d:getcontentlength>
    <d:getlastmodified>Fri, 23 Oct 2026 10:00:00 GMT</d:getlastmodified><d:getetag>&quot;abc123&quot;</d:getetag>
    </d:prop></d:propstat></d:response>
</d:multistatus>`;
    const entries = parseMultistatus(xml);
    expect(entries).toHaveLength(2);
    expect(entries[0].isDir).toBe(true);
    expect(entries[1]).toMatchObject({ isDir: false, size: 2048, etag: "abc123" });
  });
});
