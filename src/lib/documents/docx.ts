import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import { toBlocks, type Run } from "./markdown";

export type RenderMeta = { title: string; subtitle?: string; author?: string; date?: string };

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

function runs(list: Run[]): ParagraphChild[] {
  return list.map((r) => {
    const text = new TextRun({
      text: r.text,
      bold: r.bold,
      italics: r.italic,
      strike: r.strike,
      font: r.code ? "Consolas" : undefined,
      style: r.link ? "Hyperlink" : undefined,
    });
    return r.link ? new ExternalHyperlink({ link: r.link, children: [text] }) : text;
  });
}

export async function renderDocx(markdown: string, meta: RenderMeta): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(meta.title)] }),
  ];
  const byline = [meta.subtitle, meta.author, meta.date].filter(Boolean).join(" · ");
  if (byline) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: byline, color: "6B6B6B", size: 20 })], spacing: { after: 240 } }),
    );
  }

  let listCounter = 0;
  for (const block of toBlocks(markdown)) {
    switch (block.kind) {
      case "heading":
        children.push(new Paragraph({ heading: HEADINGS[block.level - 1], children: runs(block.runs) }));
        break;
      case "paragraph":
        children.push(new Paragraph({ children: runs(block.runs), spacing: { after: 120 } }));
        break;
      case "list": {
        const reference = block.ordered ? `numbered-${listCounter++}` : "bullets";
        for (const item of block.items) {
          children.push(
            new Paragraph({
              children: runs(item.runs),
              numbering: { reference, level: Math.min(item.depth, 2) },
            }),
          );
        }
        break;
      }
      case "table":
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: block.header.map(
                  (cell) =>
                    new TableCell({
                      shading: { type: ShadingType.CLEAR, color: "auto", fill: "EDEDED" },
                      children: [new Paragraph({ children: runs(cell.map((r) => ({ ...r, bold: true }))) })],
                    }),
                ),
              }),
              ...block.rows.map(
                (row) =>
                  new TableRow({
                    children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: runs(cell) })] })),
                  }),
              ),
            ],
          }),
          new Paragraph({ text: "" }),
        );
        break;
      case "code":
        for (const line of block.text.split("\n")) {
          children.push(
            new Paragraph({
              shading: { type: ShadingType.CLEAR, color: "auto", fill: "F4F4F4" },
              children: [new TextRun({ text: line || " ", font: "Consolas", size: 19 })],
            }),
          );
        }
        break;
      case "quote":
        children.push(
          new Paragraph({
            indent: { left: 480 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: "BBBBBB", space: 8 } },
            children: runs(block.runs),
          }),
        );
        break;
      case "rule":
        children.push(
          new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } } }),
        );
        break;
    }
  }

  const numberedConfigs = Array.from({ length: listCounter }, (_, i) => ({
    reference: `numbered-${i}`,
    levels: [0, 1, 2].map((level) => ({
      level,
      format: level === 1 ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL,
      text: level === 1 ? `%${level + 1})` : `%${level + 1}.`,
      alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    })),
  }));

  const doc = new Document({
    creator: meta.author ?? "Chat Engine",
    title: meta.title,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["•", "◦", "▪"][level],
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
        ...numberedConfigs,
      ],
    },
    sections: [{ children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
