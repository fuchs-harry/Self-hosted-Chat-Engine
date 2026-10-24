import PDFDocument from "pdfkit";
import type { RenderMeta } from "./docx";
import { toBlocks, type Run } from "./markdown";

// PDFKit's built-in Helvetica/Courier use WinAnsi encoding: German umlauts,
// ß and € work; characters outside it (emoji, CJK) are replaced.
const FONT = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  boldItalic: "Helvetica-BoldOblique",
  mono: "Courier",
};
const SIZES = [20, 16, 13.5, 12, 11, 11];
const TEXT = "#111111";
const MUTED = "#6b6b6b";
const MARGIN = 64;

function sanitize(s: string): string {
  // Keep Latin-1 plus the WinAnsi extras PDFKit maps (€, quotes, dashes).
  return s.replace(/[^\u0009\u000a -ÿ€‚„…†‡‰‹›‘’“”•–—™]/g, "?");
}

function fontFor(r: Run): string {
  if (r.code) return FONT.mono;
  if (r.bold && r.italic) return FONT.boldItalic;
  if (r.bold) return FONT.bold;
  if (r.italic) return FONT.italic;
  return FONT.regular;
}

function writeRuns(
  doc: PDFKit.PDFDocument,
  runs: Run[],
  opts: { size: number; x?: number; width?: number; color?: string; bold?: boolean },
) {
  const list = runs.length ? runs : [{ text: "" }];
  list.forEach((r, i) => {
    const run = opts.bold ? { ...r, bold: true } : r;
    doc
      .font(fontFor(run))
      .fontSize(r.code ? opts.size - 1 : opts.size)
      .fillColor(r.link ? "#1d4ed8" : (opts.color ?? TEXT));
    const textOpts: PDFKit.Mixins.TextOptions = {
      continued: i < list.length - 1,
      link: r.link,
      underline: Boolean(r.link),
      strike: r.strike,
      lineGap: 2.5,
    };
    if (i === 0 && opts.x !== undefined) {
      doc.text(sanitize(r.text), opts.x, doc.y, { ...textOpts, width: opts.width });
    } else {
      doc.text(sanitize(r.text), textOpts);
    }
  });
}

export async function renderPdf(markdown: string, meta: RenderMeta): Promise<Uint8Array> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: meta.title, Author: meta.author ?? "Chat Engine", Creator: "Chat Engine" },
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const width = doc.page.width - MARGIN * 2;

  doc.font(FONT.bold).fontSize(24).fillColor(TEXT).text(sanitize(meta.title), { width });
  const byline = [meta.subtitle, meta.author, meta.date].filter(Boolean).join(" · ");
  if (byline) doc.moveDown(0.3).font(FONT.regular).fontSize(10).fillColor(MUTED).text(sanitize(byline));
  doc.moveDown(0.6);
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).lineWidth(0.6).strokeColor("#cccccc").stroke();
  doc.moveDown(1);

  for (const block of toBlocks(markdown)) {
    switch (block.kind) {
      case "heading":
        doc.moveDown(0.6);
        writeRuns(doc, block.runs, { size: SIZES[block.level - 1], bold: true, x: MARGIN, width });
        doc.moveDown(0.3);
        break;
      case "paragraph":
        writeRuns(doc, block.runs, { size: 10.5, x: MARGIN, width });
        doc.moveDown(0.6);
        break;
      case "list": {
        let n = block.start;
        for (const item of block.items) {
          const indent = MARGIN + 14 + item.depth * 16;
          const marker = block.ordered && item.depth === 0 ? `${n++}.` : item.depth ? "◦" : "•";
          const y = doc.y;
          doc.font(FONT.regular).fontSize(10.5).fillColor(TEXT).text(sanitize(marker), indent - 14, y, { width: 14 });
          doc.y = y;
          writeRuns(doc, item.runs, { size: 10.5, x: indent, width: width - (indent - MARGIN) });
          doc.moveDown(0.25);
        }
        doc.x = MARGIN;
        doc.moveDown(0.4);
        break;
      }
      case "table": {
        const cols = Math.max(block.header.length, 1);
        const colW = width / cols;
        const drawRow = (cells: Run[][], header: boolean) => {
          const texts = cells.map((c) => sanitize(c.map((r) => r.text).join("")));
          doc.font(header ? FONT.bold : FONT.regular).fontSize(9.5);
          const h = Math.max(...texts.map((t) => doc.heightOfString(t, { width: colW - 10 }))) + 10;
          if (doc.y + h > doc.page.height - MARGIN) doc.addPage();
          const top = doc.y;
          if (header) doc.rect(MARGIN, top, width, h).fill("#eeeeee");
          texts.forEach((t, i) => {
            doc
              .fillColor(TEXT)
              .font(header ? FONT.bold : FONT.regular)
              .fontSize(9.5)
              .text(t, MARGIN + i * colW + 5, top + 5, { width: colW - 10 });
          });
          doc.rect(MARGIN, top, width, h).lineWidth(0.5).strokeColor("#cccccc").stroke();
          doc.y = top + h;
        };
        drawRow(block.header, true);
        for (const row of block.rows) drawRow(row, false);
        doc.x = MARGIN;
        doc.moveDown(0.8);
        break;
      }
      case "code": {
        doc.font(FONT.mono).fontSize(9);
        const h = doc.heightOfString(sanitize(block.text), { width: width - 16 }) + 12;
        if (doc.y + h > doc.page.height - MARGIN) doc.addPage();
        const top = doc.y;
        doc.rect(MARGIN, top, width, h).fill("#f4f4f4");
        doc.fillColor(TEXT).text(sanitize(block.text), MARGIN + 8, top + 6, { width: width - 16 });
        doc.x = MARGIN;
        doc.y = top + h;
        doc.moveDown(0.6);
        break;
      }
      case "quote": {
        const top = doc.y;
        writeRuns(doc, block.runs, { size: 10.5, x: MARGIN + 14, width: width - 14, color: MUTED });
        doc.moveTo(MARGIN + 3, top).lineTo(MARGIN + 3, doc.y).lineWidth(2).strokeColor("#bbbbbb").stroke();
        doc.x = MARGIN;
        doc.moveDown(0.6);
        break;
      }
      case "rule":
        doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).lineWidth(0.6).strokeColor("#cccccc").stroke();
        doc.moveDown(0.8);
        break;
    }
  }

  // Page numbers.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font(FONT.regular)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(`${i + 1} / ${range.count}`, MARGIN, doc.page.height - MARGIN / 2 - 6, {
        width,
        align: "right",
        lineBreak: false,
      });
  }

  doc.end();
  await done;
  return new Uint8Array(Buffer.concat(chunks));
}
