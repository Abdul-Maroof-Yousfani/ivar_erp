import { Client } from 'pg';

// Standalone script using pg directly so we have full control over the tenant database update
async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:root@localhost:5432/tenant_ivar_mo2z612h?schema=public',
  });
  await client.connect();

  console.log('Connected to tenant DB');

  // 1. Fetch ChartOfAccounts
  const coaRes = await client.query(`SELECT id, code, name FROM "ChartOfAccount"`);
  const coaByCode = new Map<string, { id: string; name: string }>();
  coaRes.rows.forEach((r) => coaByCode.set(r.code, { id: r.id, name: r.name }));

  const fallbackId = coaRes.rows[0]?.id || 'MISSING';

  const salesControlId = coaByCode.get('4001')?.id || coaByCode.get('40')?.id || fallbackId;
  const salesReturnControlId = coaByCode.get('5101')?.id || coaByCode.get('51')?.id || fallbackId;
  const bankControlId = coaByCode.get('3201')?.id || coaByCode.get('32')?.id || fallbackId;
  const operatingExpControlId = coaByCode.get('5201')?.id || coaByCode.get('52')?.id || fallbackId;
  const payablesControlId = coaByCode.get('2001')?.id || coaByCode.get('20')?.id || fallbackId;

  const outletSalesMap: Record<string, string> = {
    'ZB1-LHR': '40010013',
    'I81-ISB': '40010015',
    'SFD2-KHI': '40010016',
    'BC1-KHI': '40010012',
  };

  const outletSalesReturnMap: Record<string, string> = {
    'ZB1-LHR': '51010007',
    'I81-ISB': '51010009',
    'SFD2-KHI': '51010010',
    'BC1-KHI': '51010004',
  };

  const outletBankChargesMap: Record<string, string> = {
    'ZB1-LHR': '52010034',
    'I81-ISB': '52010044',
    'SFD2-KHI': '52010059',
    'BC1-KHI': '52010017',
  };

  // 2. Fetch all locations
  const locRes = await client.query(`SELECT id, code, name, "cashGLCode" FROM "Location"`);
  const locByCode = new Map<string, any>();
  locRes.rows.forEach((l) => locByCode.set(l.code, l));

  // 3. Fetch all MerchantConfigs
  const merchantRes = await client.query(`SELECT "bankName", "bankGlCode" FROM "MerchantConfig" ORDER BY "createdAt" DESC`);
  const merchantByBank = new Map<string, string>();
  merchantRes.rows.forEach((m) => {
    if (m.bankName && !merchantByBank.has(m.bankName)) {
      merchantByBank.set(m.bankName, m.bankGlCode);
    }
  });

  // 4. Fetch all RSRV vouchers
  const rvs = await client.query(`
    SELECT rv.id, rv."rvNo", rv."rvDate", rv.description
    FROM "ReceiptVoucher" rv
    WHERE rv.type = 'rs_rv'
    ORDER BY rv."rvDate" ASC, rv."rvNo" ASC;
  `);

  console.log(`Found ${rvs.rows.length} rs_rv vouchers to update.`);

  let updatedCount = 0;

  for (const rv of rvs.rows) {
    // Extract locCode from description: e.g. "... (ZB1-LHR) on 2026-08-30" or "... for ZB1-LHR on ..."
    let locCode = '';
    const matchParen = rv.description?.match(/\(([A-Z0-9\-]+)\)/);
    if (matchParen) {
      locCode = matchParen[1];
    } else {
      for (const code of locByCode.keys()) {
        if (rv.description?.includes(code)) {
          locCode = code;
          break;
        }
      }
    }

    if (!locCode || !locByCode.has(locCode)) {
      console.warn(`Could not determine location for voucher ${rv.rvNo} (desc: ${rv.description})`);
      continue;
    }

    const locationObj = locByCode.get(locCode);
    const locationId = locationObj.id;

    // Date string YYYY-MM-DD
    const d = new Date(rv.rvDate);
    const dateStr = d.toISOString().split('T')[0];

    // Compute reconciliation data directly from DB
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

    const ordersRes = await client.query(`
      SELECT o.id, o.subtotal, o."discountAmount", o."globalDiscountAmount", o."taxAmount",
             o."grandTotal", o."cashAmount", o."cardAmount", o."changeAmount", o."tenderType",
             o."paymentMethod", o."merchantId", m."bankName", m."commissionRate"
      FROM "SalesOrder" o
      LEFT JOIN "MerchantConfig" m ON o."merchantId" = m.id
      WHERE o."locationId" = $1
        AND o."createdAt" >= $2 AND o."createdAt" <= $3;
    `, [locationId, startOfDay, endOfDay]);

    const orderIds = ordersRes.rows.map((o) => o.id);

    let redemptionsRes = { rows: [] as any[] };
    if (orderIds.length > 0) {
      redemptionsRes = await client.query(`
        SELECT r."salesOrderId", r."amountUsed", r."voucherId", v."voucherType", v."faceValue"
        FROM "VoucherRedemption" r
        JOIN "Voucher" v ON r."voucherId" = v.id
        WHERE r."salesOrderId" = ANY($1);
      `, [orderIds]);
    }

    const redemptionsByOrder = new Map<string, any[]>();
    redemptionsRes.rows.forEach((r) => {
      if (!redemptionsByOrder.has(r.salesOrderId)) redemptionsByOrder.set(r.salesOrderId, []);
      redemptionsByOrder.get(r.salesOrderId)!.push(r);
    });

    const issuedVouchersRes = await client.query(`
      SELECT v.id, v.code, v."faceValue", v.discount, v."voucherType", v."sourceOrderId", v.description
      FROM "Voucher" v
      WHERE v."issuedByLocationId" = $1
        AND v."createdAt" >= $2 AND v."createdAt" <= $3;
    `, [locationId, startOfDay, endOfDay]);

    // Calculate totals
    let totalCashReceived = 0;
    let totalCardReceived = 0;
    let totalVouchersReceivedAmt = 0;

    const cardGroup: Record<string, { bank: string; amount: number; commission: number }> = {};
    const cardVoucherGroup: Record<string, { bank: string; amount: number; commission: number }> = {};

    let cashGiftVouchersAmt = 0;
    let cardGiftVouchersAmt = 0;

    for (const order of ordersRes.rows) {
      const redemptions = redemptionsByOrder.get(order.id) || [];
      const voucherRedemptionsSum = redemptions.reduce((s, r) => s + Number(r.amountUsed || 0), 0);

      const rawCash = Number(order.cashAmount ?? 0);
      const rawCard = Number(order.cardAmount ?? 0);
      const grandTotal = Number(order.grandTotal ?? 0);
      const change = Number(order.changeAmount ?? 0);

      let cash = rawCash;
      let card = rawCard;

      if (order.tenderType !== 'split' && order.paymentMethod) {
        if (order.paymentMethod === 'cash') {
          card = 0;
          if (cash === 0) cash = Math.max(0, grandTotal - voucherRedemptionsSum);
        } else if (order.paymentMethod === 'card' || order.paymentMethod === 'bank_transfer') {
          cash = 0;
          if (card === 0) card = Math.max(0, grandTotal - voucherRedemptionsSum);
        } else if (order.paymentMethod === 'voucher') {
          cash = 0;
          card = 0;
        }
      } else {
        const excess = Math.max(0, cash + card + voucherRedemptionsSum - (grandTotal + change));
        if (excess > 0) {
          if (card > 0) card = Math.max(0, card - excess);
          else cash = Math.max(0, cash - excess);
        }
      }

      if (cash > 0) totalCashReceived += cash;
      if (card > 0) {
        totalCardReceived += card;
        const bankName = order.bankName || 'Unknown Bank';
        const rateDecimal = Number(order.commissionRate ?? 0);

        const orderIssuedVouchers = issuedVouchersRes.rows.filter(
          (v) => v.sourceOrderId === order.id && (v.voucherType === 'GIFT' || v.voucherType === 'CORPORATE')
        );
        const vouchersValue = orderIssuedVouchers.reduce((s, v) => {
          const fVal = Number(v.faceValue);
          const disc = Number(v.discount ?? 0);
          return s + (fVal - disc);
        }, 0);

        const voucherCardAmt = Math.min(card, vouchersValue);
        const regularCardAmt = card - voucherCardAmt;

        if (regularCardAmt > 0) {
          if (!cardGroup[bankName]) cardGroup[bankName] = { bank: bankName, amount: 0, commission: 0 };
          cardGroup[bankName].amount += regularCardAmt;
          cardGroup[bankName].commission += regularCardAmt * rateDecimal;
        }

        if (voucherCardAmt > 0) {
          if (!cardVoucherGroup[bankName]) cardVoucherGroup[bankName] = { bank: bankName, amount: 0, commission: 0 };
          cardVoucherGroup[bankName].amount += voucherCardAmt;
          cardVoucherGroup[bankName].commission += voucherCardAmt * rateDecimal;
        }
      }

      totalVouchersReceivedAmt += voucherRedemptionsSum;
    }

    // Issued vouchers (sales return)
    let exchangeAndClaimsTotal = 0;
    let refundVouchersTotal = 0;
    let unusedBalanceVouchersTotal = 0;

    for (const v of issuedVouchersRes.rows) {
      const faceValue = Number(v.faceValue);
      if (v.description && v.description.includes('unused balance from')) {
        unusedBalanceVouchersTotal += faceValue;
      }
      if (v.voucherType === 'EXCHANGE') {
        exchangeAndClaimsTotal += faceValue;
      } else if (v.voucherType === 'REFUND') {
        refundVouchersTotal += faceValue;
      } else if (v.voucherType === 'GIFT' || v.voucherType === 'CORPORATE') {
        const netAmt = faceValue - Number(v.discount ?? 0);
        let isCard = false;
        let isCash = false;
        if (v.sourceOrderId) {
          const linked = ordersRes.rows.find((o) => o.id === v.sourceOrderId);
          if (linked) {
            isCard = Number(linked.cardAmount ?? 0) > 0;
            isCash = Number(linked.cashAmount ?? 0) > 0;
          }
        }
        if (isCard) cardGiftVouchersAmt += netAmt;
        else if (isCash) {
          cashGiftVouchersAmt += netAmt;
          if (!v.sourceOrderId || !ordersRes.rows.some((o) => o.id === v.sourceOrderId)) {
            totalCashReceived += netAmt;
          }
        }
      }
    }

    // FBR Charges
    let fbrCashCount = 0;
    let fbrCardCount = 0;
    for (const order of ordersRes.rows) {
      if (order.cardAmount && Number(order.cardAmount) > 0) fbrCardCount++;
      else fbrCashCount++;
    }
    const fbrTotal = fbrCashCount + fbrCardCount;

    const returnAmount = exchangeAndClaimsTotal + refundVouchersTotal;
    const creditCardGiftVouchersTotal = Object.values(cardVoucherGroup).reduce((s, v) => s + v.amount, 0);
    const computedSale =
      totalCardReceived -
      creditCardGiftVouchersTotal +
      (totalCashReceived + totalVouchersReceivedAmt - cashGiftVouchersAmt) -
      fbrTotal -
      unusedBalanceVouchersTotal;

    const grossSale = computedSale;
    const salesReturn = returnAmount;

    // Now build details lines
    const details: any[] = [];

    // 1. Cash Tag Account
    let cashTagId = fallbackId;
    if (locationObj?.cashGLCode && coaByCode.has(locationObj.cashGLCode)) {
      cashTagId = coaByCode.get(locationObj.cashGLCode)!.id;
    } else if (coaByCode.has('32010002')) {
      cashTagId = coaByCode.get('32010002')!.id;
    } else if (coaByCode.has('31090001')) {
      cashTagId = coaByCode.get('31090001')!.id;
    }

    const cashSaleAmt = Math.max(0, totalCashReceived - cashGiftVouchersAmt);
    if (cashSaleAmt > 0) {
      details.push({
        accountId: bankControlId,
        tagAccountId: cashTagId,
        debit: cashSaleAmt,
        credit: 0,
        narration: `Cash sales deposited to UBL Bank A/C | ${locCode} | ${dateStr}`,
      });
    }

    // 2. Cards
    let totalComm = 0;
    const cardPayments = Object.values(cardGroup);
    for (const card of cardPayments) {
      const comm = Number((card.commission ?? 0).toFixed(2));
      totalComm += comm;
      const netCard = Number(((card.amount ?? 0) - comm).toFixed(2));

      const bankGlCode = merchantByBank.get(card.bank);
      let cardTagId = fallbackId;
      if (bankGlCode && coaByCode.has(bankGlCode)) {
        cardTagId = coaByCode.get(bankGlCode)!.id;
      } else if (card.bank?.toLowerCase().includes('meezan') && coaByCode.has('32010001')) {
        cardTagId = coaByCode.get('32010001')!.id;
      } else if (coaByCode.has('32010003')) {
        cardTagId = coaByCode.get('32010003')!.id;
      }

      if (netCard > 0) {
        details.push({
          accountId: bankControlId,
          tagAccountId: cardTagId,
          debit: netCard,
          credit: 0,
          narration: `Credit Card settlement ${card.bank} | ${locCode} | ${dateStr}`,
        });
      }
    }

    // 3. Bank Commission
    if (totalComm > 0) {
      const commCode = outletBankChargesMap[locCode] || '52010017';
      const commTagId = coaByCode.has(commCode) ? coaByCode.get(commCode)!.id : fallbackId;
      details.push({
        accountId: operatingExpControlId,
        tagAccountId: commTagId,
        debit: totalComm,
        credit: 0,
        narration: `POS Credit Card merchant commission | ${locCode} | ${dateStr}`,
      });
    }

    // 4. Vouchers Redeemed (Tenders)
    if (totalVouchersReceivedAmt > 0) {
      const vTagId = coaByCode.get('20010050')?.id || fallbackId;
      details.push({
        accountId: payablesControlId,
        tagAccountId: vTagId,
        debit: totalVouchersReceivedAmt,
        credit: 0,
        narration: `Exchange Vouchers collected/redeemed | ${locCode} | ${dateStr}`,
      });
    }

    // 5. Sales Return
    if (salesReturn > 0) {
      const returnCode = outletSalesReturnMap[locCode] || '51010001';
      const returnTagId = coaByCode.has(returnCode) ? coaByCode.get(returnCode)!.id : fallbackId;
      details.push({
        accountId: salesReturnControlId,
        tagAccountId: returnTagId,
        debit: salesReturn,
        credit: 0,
        narration: `Daily POS Sales Return | ${locCode} | ${dateStr}`,
      });
    }

    // 6. FBR Charges (Credit)
    if (fbrTotal > 0) {
      const fbrTagId = coaByCode.get('20010055')?.id || fallbackId;
      details.push({
        accountId: payablesControlId,
        tagAccountId: fbrTagId,
        debit: 0,
        credit: fbrTotal,
        narration: `FBR POS Service Charges | ${locCode} | ${dateStr}`,
      });
    }

    // 7. Gross Sales Revenue (Credit)
    const salesCode = outletSalesMap[locCode];
    let salesTagId = fallbackId;
    if (salesCode && coaByCode.has(salesCode)) {
      salesTagId = coaByCode.get(salesCode)!.id;
    }
    if (grossSale > 0) {
      details.push({
        accountId: salesControlId,
        tagAccountId: salesTagId,
        debit: 0,
        credit: grossSale,
        narration: `Daily POS Sales Revenue | ${locCode} | ${dateStr}`,
      });
    }

    // Auto-balance check
    let totalDebit = 0;
    let totalCredit = 0;
    details.forEach((item) => {
      totalDebit = Number((totalDebit + item.debit).toFixed(2));
      totalCredit = Number((totalCredit + item.credit).toFixed(2));
    });

    const diff = Math.abs(totalDebit - totalCredit);
    if (diff > 0.001) {
      if (totalDebit < totalCredit) {
        const adj = Number((totalCredit - totalDebit).toFixed(2));
        const firstDebit = details.find((item) => item.debit > 0);
        if (firstDebit) {
          firstDebit.debit = Number((firstDebit.debit + adj).toFixed(2));
          totalDebit = Number((totalDebit + adj).toFixed(2));
        }
      } else {
        const adj = Number((totalDebit - totalCredit).toFixed(2));
        const salesLine = details.find((item) => item.tagAccountId === salesTagId && item.credit > 0);
        if (salesLine) {
          salesLine.credit = Number((salesLine.credit + adj).toFixed(2));
          totalCredit = Number((totalCredit + adj).toFixed(2));
        }
      }
    }

    // Transaction to update this voucher in DB
    await client.query('BEGIN');
    try {
      // Delete existing details
      await client.query(`DELETE FROM "ReceiptVoucherDetail" WHERE "receiptVoucherId" = $1`, [rv.id]);

      // Update voucher header
      const firstDebitLine = details.find((d) => d.debit > 0);
      const debitAccountId = firstDebitLine ? firstDebitLine.accountId : bankControlId;

      await client.query(`
        UPDATE "ReceiptVoucher"
        SET "debitAccountId" = $1, "debitAmount" = $2
        WHERE id = $3
      `, [debitAccountId, totalDebit, rv.id]);

      // Insert new details
      for (const d of details) {
        await client.query(`
          INSERT INTO "ReceiptVoucherDetail"
            (id, "receiptVoucherId", "accountId", "tagAccountId", debit, credit, narration, "taxType", "createdAt", "updatedAt")
          VALUES
            (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'Taxable', NOW(), NOW())
        `, [rv.id, d.accountId, d.tagAccountId || null, d.debit, d.credit, d.narration]);
      }

      await client.query('COMMIT');
      updatedCount++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Failed to update voucher ${rv.rvNo}:`, err);
    }
  }

  console.log(`Successfully updated ${updatedCount} rs_rv vouchers!`);
  await client.end();
}

main().catch(console.error);
