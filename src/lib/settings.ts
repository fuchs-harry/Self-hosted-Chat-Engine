import "server-only";
import { db } from "@/lib/db";

/**
 * Organization-wide settings with their defaults. Stored as JSON rows in
 * `app_settings`; anything not stored falls back to the value here.
 */
export const SETTING_DEFAULTS = {
  /** Free-text company context injected into every chat ("who we are"). */
  company_profile: "",
  /** How the assistant should behave: tone, language, rules. */
  assistant_instructions: "",
  /** Pseudonymize e-mails, IBANs, phone numbers etc. before cloud calls. */
  pii_masking: true,
  /** Delete chats older than N days. 0 keeps them forever. */
  chat_retention_days: 0,
  /** Let the assistant learn durable facts about users. */
  memory_enabled: true,
  /** Model used when a user hasn't picked one, as "provider:model". */
  default_model: "",
  /** If non-empty, only these "provider:model" keys are offered. */
  allowed_models: [] as string[],
  /** Only offer models whose data stays in the EU or on-premises. */
  eu_only: false,
};

export type Settings = typeof SETTING_DEFAULTS;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await db()<{ key: string; value: unknown }[]>`SELECT key, value FROM app_settings`;
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const row of rows) {
    if (row.key in SETTING_DEFAULTS) out[row.key] = row.value;
  }
  return out as Settings;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const [row] = await db()<{ value: Settings[K] }[]>`
    SELECT value FROM app_settings WHERE key = ${key}`;
  return row ? row.value : SETTING_DEFAULTS[key];
}

export async function updateSettings(
  patch: Partial<Settings>,
  userId: string | null,
): Promise<void> {
  const sql = db();
  await sql.begin(async (tx) => {
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in SETTING_DEFAULTS) || value === undefined) continue;
      await tx`
        INSERT INTO app_settings (key, value, updated_by)
        VALUES (${key}, ${tx.json(value as never)}, ${userId})
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`;
    }
  });
}
