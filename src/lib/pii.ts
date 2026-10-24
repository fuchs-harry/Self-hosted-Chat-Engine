/**
 * Reversible pseudonymization of personal data before a prompt leaves the
 * server. Values are replaced with stable placeholders ("[EMAIL_1]") for the
 * duration of one request; the answer is restored on the way back, so users
 * see real values while the model provider only ever sees placeholders.
 *
 * Detection is pattern-based with checksums where they exist (IBAN mod-97,
 * Luhn for cards, the Austrian social security check digit) to keep false
 * positives low. It is a safety net, not a full DLP system.
 */

export type PiiType = "EMAIL" | "IBAN" | "CARD" | "SVNR" | "PHONE";

type Detector = { type: PiiType; pattern: RegExp; valid?: (match: string) => boolean };

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

export function validIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, "").toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of code) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

export function validLuhn(raw: string): boolean {
  const d = digits(raw);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Austrian social security number: 3-digit serial, check digit, birth date
 * DDMMYY. Check digit = (3,7,9 · serial + 5,8,4,2,1,6 · date) mod 11.
 */
export function validSvnr(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 10) return false;
  const w = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6];
  const sum = w.reduce((acc, weight, i) => acc + weight * Number(d[i]), 0);
  const check = sum % 11;
  if (check === 10 || check !== Number(d[3])) return false;
  const day = Number(d.slice(4, 6));
  const month = Number(d.slice(6, 8));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

const DETECTORS: Detector[] = [
  { type: "EMAIL", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  {
    type: "IBAN",
    pattern: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g,
    valid: validIban,
  },
  { type: "CARD", pattern: /\b\d(?:[ -]?\d){12,18}\b/g, valid: validLuhn },
  { type: "SVNR", pattern: /\b\d{4} ?\d{6}\b/g, valid: validSvnr },
  {
    // International (+43 / 0043) or national (0664 ..., 01 ...) numbers with
    // 8 to 15 digits.
    type: "PHONE",
    pattern: /(?<![\w+])(?:\+|00)\d{1,3}[ /.-]?(?:\(0\))?[ /.-]?\d{1,4}(?:[ /.-]?\d{2,}){1,4}\b|(?<![\w/.-])0\d{1,4}[ /-]\d{3,}(?:[ /-]?\d{2,}){0,3}\b/g,
    valid: (m) => {
      const n = digits(m).length;
      return n >= 8 && n <= 15;
    },
  },
];

const TOKEN = /\[(EMAIL|IBAN|CARD|SVNR|PHONE)_(\d{1,4})\]/g;

export class Pseudonymizer {
  private toToken = new Map<string, string>();
  private toValue = new Map<string, string>();
  private counters = new Map<PiiType, number>();

  get count(): number {
    return this.toValue.size;
  }

  mask(text: string): string {
    let out = text;
    for (const d of DETECTORS) {
      out = out.replace(d.pattern, (match) => {
        if (match.startsWith("[") || (d.valid && !d.valid(match))) return match;
        const key = `${d.type}:${match.replace(/\s/g, "").toLowerCase()}`;
        let token = this.toToken.get(key);
        if (!token) {
          const n = (this.counters.get(d.type) ?? 0) + 1;
          this.counters.set(d.type, n);
          token = `[${d.type}_${n}]`;
          this.toToken.set(key, token);
          this.toValue.set(token, match);
        }
        return token;
      });
    }
    return out;
  }

  unmask(text: string): string {
    if (!this.toValue.size) return text;
    return text.replace(TOKEN, (token) => this.toValue.get(token) ?? token);
  }

  /** Restores placeholders in any JSON-like value (tool inputs). */
  unmaskDeep<T>(value: T): T {
    if (!this.toValue.size) return value;
    if (typeof value === "string") return this.unmask(value) as T;
    if (Array.isArray(value)) return value.map((v) => this.unmaskDeep(v)) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.unmaskDeep(v)]),
      ) as T;
    }
    return value;
  }

  /**
   * Streaming restore: placeholders can be split across chunks ("[EMA" +
   * "IL_1]"), so a possible placeholder start is held back until it
   * completes or clearly isn't one.
   */
  streamRestorer(): { push: (chunk: string) => string; flush: () => string } {
    let pending = "";
    return {
      push: (chunk: string) => {
        pending += chunk;
        const open = pending.lastIndexOf("[");
        if (open >= 0 && !pending.includes("]", open) && pending.length - open < 16) {
          const ready = pending.slice(0, open);
          pending = pending.slice(open);
          return this.unmask(ready);
        }
        const out = this.unmask(pending);
        pending = "";
        return out;
      },
      flush: () => {
        const out = this.unmask(pending);
        pending = "";
        return out;
      },
    };
  }
}
