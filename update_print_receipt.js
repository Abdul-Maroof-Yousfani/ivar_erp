const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'components', 'pos', 'print-receipt.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const normalize = str => str.replace(/\r\n/g, '\n');

// Replacement 1: totalPaid and deliveryFee
const oldBlock1 = `  const totalPaid = tenders.reduce(
    (s, t) =>
      s +
      (t.method === "voucher" && t.voucherFaceValue
        ? t.voucherFaceValue
        : t.amount),
    0,
  );

  const deliveryFee = (() => {
    const match = order?.notes?.match(/Delivery Charges:\\s*Rs\\.?\\s*([\\d.,]+)/i);
    if (match && match[1]) return parseFloat(match[1].replace(/,/g, ""));
    if (order?.notes?.includes("Source: Courierify") || order?.paymentMethod?.toUpperCase() === "COD") {
      if (totalPaid > grandTotal) return totalPaid - grandTotal;
    }
    return 0;
  })();`;

const newBlock1 = `  const totalPaid = tenders.reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );

  const deliveryFee = (() => {
    const match = order?.notes?.match(/Delivery Charges:\\s*Rs\\.?\\s*([\\d.,]+)/i);
    if (match && match[1]) return parseFloat(match[1].replace(/,/g, ""));
    const itemsTotal = (order?.items || []).reduce(
      (acc: number, item: any) => acc + Number(item.lineTotal || 0),
      0,
    );
    if (itemsTotal > 0 && grandTotal > itemsTotal) {
      return grandTotal - itemsTotal;
    }
    return 0;
  })();`;

// Replacement 2: tender row value in thermal receipt
const oldBlock2 = `              value={
                t.method === "voucher" && t.voucherFaceValue
                  ? fmt(t.voucherFaceValue)
                  : fmt(t.amount)
              }`;

const newBlock2 = `              value={fmt(t.amount)}`;

let updated = normalize(content);

if (updated.includes(normalize(oldBlock1))) {
  updated = updated.replace(normalize(oldBlock1), normalize(newBlock1));
  console.log('✓ Replacement 1 succeeded');
} else {
  console.error('❌ Replacement 1 failed');
}

if (updated.includes(normalize(oldBlock2))) {
  updated = updated.replace(normalize(oldBlock2), normalize(newBlock2));
  console.log('✓ Replacement 2 succeeded');
} else {
  console.error('❌ Replacement 2 failed');
}

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Done.');

