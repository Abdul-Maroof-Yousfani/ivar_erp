// ─── Code 128 B encoder (pure, no external dependency) ───────────────────────

const CODE128_PATTERNS: Record<string, string> = {
    " ": "11011001100", "!": "11001101100", '"': "11001100110", "#": "10010011000",
    "$": "10010001100", "%": "10001001100", "&": "10011001000", "'": "10011000100",
    "(": "10001100100", ")": "11001001000", "*": "11001000100", "+": "11000100100",
    ",": "10110011100", "-": "10011011100", ".": "10011001110", "/": "10111001100",
    "0": "10011101100", "1": "10011100110", "2": "11001110010", "3": "11001011100",
    "4": "11001001110", "5": "11011100100", "6": "11001110100", "7": "11101101110",
    "8": "11101001100", "9": "11100101100", ":": "11100100110", ";": "11101100100",
    "<": "11100110100", "=": "11100110010", ">": "11011011000", "?": "11011000110",
    "@": "11000110110", "A": "10100011000", "B": "10001011000", "C": "10001000110",
    "D": "10110001000", "E": "10001101000", "F": "10001100010", "G": "11010001000",
    "H": "11000101000", "I": "11000100010", "J": "10110111000", "K": "10110001110",
    "L": "10001101110", "M": "10111011000", "N": "10111000110", "O": "11101011000",
    "P": "11101000110", "Q": "11100010110", "R": "11011011110", "S": "11011110110",
    "T": "11110110110", "U": "10101111000", "V": "10100011110", "W": "10001011110",
    "X": "10111101000", "Y": "10111100010", "Z": "11110101000",
    "[": "11110100010", "\\": "10111011110", "]": "10111101110", "^": "11101101000",
    "_": "11101100010", "`": "11100101110", "a": "11110100110", "b": "11110010110",
    "c": "11011110100", "d": "11011110010", "e": "11110110100", "f": "11110110010",
    "g": "10011000010", "h": "11001000010", "i": "11110001010", "j": "10100110000",
    "k": "10100001100", "l": "10010110000", "m": "10010000110", "n": "10000101100",
    "o": "10000100110", "p": "10110010000", "q": "10110000100", "r": "10011010000",
    "s": "10011000010", "t": "10000110100", "u": "10000110010", "v": "11000010010",
    "w": "11001010000", "x": "11110111010", "y": "11000010100", "z": "10001111010",
};

const CODE128_START_B = "11010010000";
const CODE128_STOP    = "1100011101011";

export function encodeCode128(text: string): string {
    const upper = text.toUpperCase();
    let bits = CODE128_START_B;
    let checksum = 104;
    for (let i = 0; i < upper.length; i++) {
        const ch = upper[i];
        const pattern = CODE128_PATTERNS[ch] ?? CODE128_PATTERNS[" "];
        bits += pattern;
        const val = ch.charCodeAt(0) - 32;
        checksum += (i + 1) * val;
    }
    const checksumVal = checksum % 103;
    const checksumChar = String.fromCharCode(checksumVal + 32);
    bits += CODE128_PATTERNS[checksumChar] ?? CODE128_PATTERNS[" "];
    bits += CODE128_STOP;
    return bits;
}

// ─── Barcode generation patterns ─────────────────────────────────────────────

function randomDigits(n: number): string {
    return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

/** EAN-13: 12 random digits + check digit */
export function generateEAN13(): string {
    const digits = randomDigits(12).split("").map(Number);
    const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0) % 10)) % 10;
    return digits.join("") + check;
}

/** UPC-A: 11 random digits + check digit */
export function generateUPCA(): string {
    const digits = randomDigits(11).split("").map(Number);
    const check = (10 - (digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0) % 10)) % 10;
    return digits.join("") + check;
}

/** Code 128 random: alphanumeric, 10 chars */
export function generateCode128Random(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** SKU-based: prefix + timestamp suffix */
export function generateFromSku(sku: string): string {
    const prefix = sku.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6).padEnd(4, "0");
    const suffix = Date.now().toString().slice(-6);
    return `${prefix}${suffix}`;
}

export type BarcodePattern = "ean13" | "upca" | "code128" | "sku";

export const BARCODE_PATTERNS: { value: BarcodePattern; label: string; description: string }[] = [
    { value: "ean13",   label: "EAN-13",      description: "13-digit retail standard" },
    { value: "upca",    label: "UPC-A",        description: "12-digit North American standard" },
    { value: "code128", label: "Code 128",     description: "10-char alphanumeric" },
    { value: "sku",     label: "SKU-based",    description: "Derived from SKU + timestamp" },
];

export function generateBarcode(pattern: BarcodePattern, sku = ""): string {
    switch (pattern) {
        case "ean13":   return generateEAN13();
        case "upca":    return generateUPCA();
        case "code128": return generateCode128Random();
        case "sku":     return generateFromSku(sku || "ITEM");
    }
}
