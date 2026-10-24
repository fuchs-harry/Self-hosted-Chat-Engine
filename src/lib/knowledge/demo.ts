import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { User } from "@/lib/auth/users";
import { db } from "@/lib/db";
import { addUpload, createKnowledgeBase } from "./index";

export const DEMO_KB_NAME = "Alpenblick Technik GmbH (Demo)";

function demoDir(): string {
  return process.env.DEMO_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "examples", "demo-data");
}

/**
 * Creates a company knowledge base with the fictional sample documents in
 * examples/demo-data, so a fresh install can be tried in one click.
 */
export async function loadDemoData(user: User): Promise<{ id: string; files: number; existed: boolean }> {
  const [existing] = await db()<{ id: string }[]>`
    SELECT id FROM knowledge_bases WHERE name = ${DEMO_KB_NAME} AND visibility = 'org'`;
  if (existing) return { id: existing.id, files: 0, existed: true };

  const id = await createKnowledgeBase(
    {
      name: DEMO_KB_NAME,
      description:
        "Fiktive Richtlinien (Reisekosten, Urlaub & Homeoffice, IT-Sicherheit) zum Ausprobieren. Kann jederzeit gelöscht werden.",
      visibility: "org",
    },
    user,
  );

  const files = (await readdir(/*turbopackIgnore: true*/ demoDir())).filter((f) => !f.startsWith("."));
  for (const name of files) {
    const bytes = new Uint8Array(await readFile(/*turbopackIgnore: true*/ path.join(demoDir(), name)));
    await addUpload(id, { name, type: "", bytes }, user);
  }
  return { id, files: files.length, existed: false };
}
