// ─── Barcode generation — standard formats ────────────────────────────────────
// All rendering is done via JsBarcode (CODE128 auto-mode).
// This module is responsible only for generating valid barcode *values*.

function randomDigits(n: number): string {
    return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

// ── EAN-13: 12 random payload digits + standard Mod-10 check digit ─────────────
export function generateEAN13(): string {
    const digits = randomDigits(12).split("").map(Number);
    const check =
        (10 -
            (digits.reduce(
                (s, d, i) => s + d * (i % 2 === 0 ? 1 : 3),
                0,
            ) %
                10)) %
        10;
    return digits.join("") + check;
}

// ── UPC-A: 11 random payload digits + standard Mod-10 check digit ─────────────
export function generateUPCA(): string {
    const digits = randomDigits(11).split("").map(Number);
    const check =
        (10 -
            (digits.reduce(
                (s, d, i) => s + d * (i % 2 === 0 ? 3 : 1),
                0,
            ) %
                10)) %
        10;
    return digits.join("") + check;
}

// ── Code 128 (alphanumeric, 10 chars) ─────────────────────────────────────────
// JsBarcode will auto-select the optimal CODE128 sub-set (A/B/C) at render time.
export function generateCode128(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(
        { length: 10 },
        () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
}

// ── SKU-based: deterministic prefix + timestamp tail ──────────────────────────
export function generateFromSku(sku: string): string {
    const prefix = sku
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 6)
        .padEnd(4, "0");
    const suffix = Date.now().toString().slice(-6);
    return `${prefix}${suffix}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export type BarcodePattern = "ean13" | "upca" | "code128" | "sku";

export const BARCODE_PATTERNS: {
    value: BarcodePattern;
    label: string;
    description: string;
}[] = [
    { value: "ean13",   label: "EAN-13",   description: "13-digit retail standard" },
    { value: "upca",    label: "UPC-A",    description: "12-digit North American standard" },
    { value: "code128", label: "Code 128", description: "10-char alphanumeric (CODE128)" },
    { value: "sku",     label: "SKU-based",description: "Derived from SKU + timestamp" },
];

export function generateBarcode(pattern: BarcodePattern, sku = ""): string {
    switch (pattern) {
        case "ean13":   return generateEAN13();
        case "upca":    return generateUPCA();
        case "code128": return generateCode128();
        case "sku":     return generateFromSku(sku || "ITEM");
    }
}
