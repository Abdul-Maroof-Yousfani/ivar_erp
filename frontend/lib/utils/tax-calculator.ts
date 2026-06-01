export function calculateTaxForAccount(
  accountCode: string,
  tagCode: string,
  taxableAmount: number
): number | null {
  if (taxableAmount <= 0) return 0;

  // 12060001 with Tag T00001 (Income Tax Slabs)
  if (accountCode === "12060001" && tagCode === "T00001") {
    let tax = 0;

    if (taxableAmount <= 600000) {
      tax = 0;
    } else if (taxableAmount <= 1200000) {
      tax = (taxableAmount - 600000) * 0.01;
    } else if (taxableAmount <= 2200000) {
      tax = 6000 + (taxableAmount - 1200000) * 0.11;
    } else if (taxableAmount <= 3200000) {
      tax = 116000 + (taxableAmount - 2200000) * 0.23;
    } else if (taxableAmount <= 4100000) {
      tax = 346000 + (taxableAmount - 3200000) * 0.30;
    } else {
      tax = 616000 + (taxableAmount - 4100000) * 0.35;
    }

    // Surcharge of 9% if taxable income exceeds 10,000,000
    if (taxableAmount > 10000000) {
      // Assuming the 9% surcharge is applied to the calculated tax, standard practice in PK
      tax = tax + (tax * 0.09);
    }

    return Math.round(tax * 100) / 100; // Round to 2 decimal places
  }

  // 12060002 with Tag T00002 (Flat 15% rate)
  if (accountCode === "12060002" && tagCode === "T00002") {
    const tax = taxableAmount * 0.15;
    return Math.round(tax * 100) / 100;
  }

  // 12060003 - WHT Payable-Goods u/s 153(1)(a)

  // T00003: 153(1)(a)/2-Goods (ATL) - 1%
  if (accountCode === "12060003" && tagCode === "T00003") {
    return Math.round(taxableAmount * 0.01 * 100) / 100;
  }

  // T00004: 153(1)(a)/2-Goods (Non ATL) - 2%
  if (accountCode === "12060003" && tagCode === "T00004") {
    return Math.round(taxableAmount * 0.02 * 100) / 100;
  }

  // T00005: 153(1)(a)/29-Goods (ATL) - 5%
  if (accountCode === "12060003" && tagCode === "T00005") {
    return Math.round(taxableAmount * 0.05 * 100) / 100;
  }

  // T00006: 153(1)(a)/29-Goods (Non ATL) - 10%
  if (accountCode === "12060003" && tagCode === "T00006") {
    return Math.round(taxableAmount * 0.10 * 100) / 100;
  }

  // T00007: 153(1)(a)/30-Goods (ATL) - 5.5% (other than companies)
  if (accountCode === "12060003" && tagCode === "T00007") {
    return Math.round(taxableAmount * 0.055 * 100) / 100;
  }

  // T00008: 153(1)(a)/30-Goods (Non ATL) - 11% (other than companies)
  if (accountCode === "12060003" && tagCode === "T00008") {
    return Math.round(taxableAmount * 0.11 * 100) / 100;
  }

  // 12060004 - WHT Payable-Services u/s 153(1)(b)

  // T00008: 153(1)(b)/29-Services (ATL) - 6%
  if (accountCode === "12060004" && tagCode === "T00008") {
    return Math.round(taxableAmount * 0.06 * 100) / 100;
  }

  // T00009: 153(1)(b)/29-Services (Non ATL) - 12%
  if (accountCode === "12060004" && tagCode === "T00009") {
    return Math.round(taxableAmount * 0.12 * 100) / 100;
  }

  // T00010: 153(1)(b)/30-Services (ATL) - 15%
  if (accountCode === "12060004" && tagCode === "T00010") {
    return Math.round(taxableAmount * 0.15 * 100) / 100;
  }

  // T00011: 153(1)(b)/30-Services (Non ATL) - 30%
  if (accountCode === "12060004" && tagCode === "T00011") {
    return Math.round(taxableAmount * 0.30 * 100) / 100;
  }

  // T00012: 153(1)(b)/26-Services (ATL) - IT/IT-enabled - 4%
  if (accountCode === "12060004" && tagCode === "T00012") {
    return Math.round(taxableAmount * 0.04 * 100) / 100;
  }

  // T00013: 153(1)(b)/26-Services (Non ATL) - IT/IT-enabled - 8%
  if (accountCode === "12060004" && tagCode === "T00013") {
    return Math.round(taxableAmount * 0.08 * 100) / 100;
  }

  // T00014: 153(1)(b)/11-Services (ATL) - Advertising (electronic/print media) - 1.5%
  if (accountCode === "12060004" && tagCode === "T00014") {
    return Math.round(taxableAmount * 0.015 * 100) / 100;
  }

  // T00015: 153(1)(b)/11-Services (Non ATL) - Advertising (electronic/print media) - 3%
  if (accountCode === "12060004" && tagCode === "T00015") {
    return Math.round(taxableAmount * 0.03 * 100) / 100;
  }

  // 12060005 - WHT Payable-Rent u/s 155

  // T00016: 155-Rent (Individual/AOP) - Slab-based
  if (accountCode === "12060005" && tagCode === "T00016") {
    let tax = 0;
    if (taxableAmount <= 300000) {
      tax = 0;
    } else if (taxableAmount <= 600000) {
      tax = (taxableAmount - 300000) * 0.05;
    } else if (taxableAmount <= 2000000) {
      tax = 15000 + (taxableAmount - 600000) * 0.10;
    } else {
      tax = 155000 + (taxableAmount - 2000000) * 0.25;
    }
    return Math.round(tax * 100) / 100;
  }

  // T00017: 155-Rent (Company ATL) - 15%
  if (accountCode === "12060005" && tagCode === "T00017") {
    return Math.round(taxableAmount * 0.15 * 100) / 100;
  }

  // T00018: 155-Rent (Company Non ATL) - 30%
  if (accountCode === "12060005" && tagCode === "T00018") {
    return Math.round(taxableAmount * 0.30 * 100) / 100;
  }

  // 12060006 - WHT Payable-Commission u/s 233

  // T00019: 233/2-Commission (ATL) - Brokerage/Commission - 12%
  if (accountCode === "12060006" && tagCode === "T00019") {
    return Math.round(taxableAmount * 0.12 * 100) / 100;
  }

  // T00020: 233/2-Commission (Non ATL) - Brokerage/Commission - 24%
  if (accountCode === "12060006" && tagCode === "T00020") {
    return Math.round(taxableAmount * 0.24 * 100) / 100;
  }

  // 12060007 - WHT Payable-Retailers u/s 236H

  // T00020: 236/H-Retailers (ATL) - 0.5%
  if (accountCode === "12060007" && tagCode === "T00020") {
    return Math.round(taxableAmount * 0.005 * 100) / 100;
  }

  // T00021: 236/H-Retailers (Non ATL) - 2.5%
  if (accountCode === "12060007" && tagCode === "T00021") {
    return Math.round(taxableAmount * 0.025 * 100) / 100;
  }

  return null; // Return null if it's not a recognized tax account
}
