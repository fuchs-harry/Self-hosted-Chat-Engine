import { describe, expect, it } from "vitest";
import { Pseudonymizer, validIban, validLuhn, validSvnr } from "@/lib/pii";

describe("checksums", () => {
  it("validates IBANs", () => {
    expect(validIban("AT61 1904 3002 3457 3201")).toBe(true);
    expect(validIban("DE89370400440532013000")).toBe(true);
    expect(validIban("AT61 1904 3002 3457 3202")).toBe(false);
  });

  it("validates card numbers with Luhn", () => {
    expect(validLuhn("4111 1111 1111 1111")).toBe(true);
    expect(validLuhn("4111 1111 1111 1112")).toBe(false);
  });

  it("validates Austrian social security numbers", () => {
    expect(validSvnr("1237 010180")).toBe(true);
    expect(validSvnr("1234 010180")).toBe(false);
    expect(validSvnr("1237 450180")).toBe(false); // day 45
  });
});

describe("Pseudonymizer", () => {
  const text =
    "Bitte überweise an AT61 1904 3002 3457 3201 und schick die Bestätigung an eva.steiner@example.at " +
    "oder ruf +43 664 1234567 an. SVNR 1237 010180. Rechnung Nr. 2026-0042 vom 12.03.2026 über 1.250,00 €.";

  it("masks personal data and leaves ordinary numbers alone", () => {
    const p = new Pseudonymizer();
    const masked = p.mask(text);
    expect(masked).toContain("[IBAN_1]");
    expect(masked).toContain("[EMAIL_1]");
    expect(masked).toContain("[PHONE_1]");
    expect(masked).toContain("[SVNR_1]");
    expect(masked).not.toContain("eva.steiner");
    expect(masked).toContain("2026-0042");
    expect(masked).toContain("12.03.2026");
    expect(masked).toContain("1.250,00 €");
    expect(p.count).toBe(4);
  });

  it("round-trips and reuses placeholders for repeated values", () => {
    const p = new Pseudonymizer();
    const masked = p.mask("eva.steiner@example.at, nochmal: Eva.Steiner@example.at");
    expect(masked).toBe("[EMAIL_1], nochmal: [EMAIL_1]");
    expect(p.unmask("Mail an [EMAIL_1]")).toBe("Mail an eva.steiner@example.at");
  });

  it("restores placeholders split across stream chunks", () => {
    const p = new Pseudonymizer();
    p.mask("eva.steiner@example.at");
    const r = p.streamRestorer();
    const out = ["Schreib an [EM", "AIL", "_1] bitte", " [nicht", " ersetzen]"].map(r.push).join("") + r.flush();
    expect(out).toBe("Schreib an eva.steiner@example.at bitte [nicht ersetzen]");
  });

  it("restores nested tool inputs", () => {
    const p = new Pseudonymizer();
    p.mask("AT61 1904 3002 3457 3201");
    expect(p.unmaskDeep({ markdown: "IBAN: [IBAN_1]", list: ["[IBAN_1]"] })).toEqual({
      markdown: "IBAN: AT61 1904 3002 3457 3201",
      list: ["AT61 1904 3002 3457 3201"],
    });
  });
});
