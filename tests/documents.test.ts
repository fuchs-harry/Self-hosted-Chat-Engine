import { describe, expect, it } from "vitest";
import { renderDocx } from "@/lib/documents/docx";
import { safeFilename, toBlocks } from "@/lib/documents/markdown";
import { renderPdf } from "@/lib/documents/pdf";

const SAMPLE = `## Zusammenfassung

Die **Reisekosten** sind *innerhalb von 30 Tagen* abzurechnen. Siehe [Portal](https://example.at).

1. Beleg hochladen
2. Freigabe abwarten
   - Führungskraft prüft

| Leistung | Betrag |
|---|---|
| Taggeld | 30,00 € |
| Kilometergeld | 0,50 € |

> Hinweis: Originalbelege sieben Jahre aufbewahren.

\`\`\`
SELECT 1;
\`\`\`
`;

describe("markdown blocks", () => {
  it("parses headings, lists, tables, quotes and code", () => {
    const kinds = toBlocks(SAMPLE).map((b) => b.kind);
    expect(kinds).toEqual(["heading", "paragraph", "list", "table", "quote", "code"]);
  });

  it("keeps inline styles and links", () => {
    const para = toBlocks(SAMPLE)[1];
    expect(para.kind).toBe("paragraph");
    if (para.kind !== "paragraph") return;
    expect(para.runs.find((r) => r.text === "Reisekosten")?.bold).toBe(true);
    expect(para.runs.find((r) => r.text === "innerhalb von 30 Tagen")?.italic).toBe(true);
    expect(para.runs.find((r) => r.text === "Portal")?.link).toBe("https://example.at");
  });

  it("flattens nested lists with depth", () => {
    const list = toBlocks(SAMPLE)[2];
    if (list.kind !== "list") throw new Error("expected list");
    expect(list.items.map((i) => i.depth)).toEqual([0, 0, 1]);
  });
});

describe("renderers", () => {
  it("renders a valid PDF with umlauts and €", async () => {
    const bytes = await renderPdf(SAMPLE, { title: "Prüfbericht Größenordnung", date: "24. Oktober 2026" });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1500);
  });

  it("renders a DOCX (zip) file", async () => {
    const bytes = await renderDocx(SAMPLE, { title: "Bericht" });
    expect(bytes[0]).toBe(0x50); // "PK"
    expect(bytes[1]).toBe(0x4b);
  });

  it("builds safe filenames", () => {
    expect(safeFilename("Größe & Übersicht: Q3/2026", "pdf")).toBe("Groe-Ubersicht-Q32026.pdf");
    expect(safeFilename("///", "md")).toBe("document.md");
  });
});
