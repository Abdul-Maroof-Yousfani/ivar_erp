"use client"
import { useState, useEffect } from "react";
import { ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { format } from "date-fns";

export function numberToWords(amount: number): string {
    const a = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const b = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    const inWords = (num: number): string => {
        let n = Math.floor(num);
        if (n === 0) return "Zero";

        const convert = (n: number): string => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? "-" + a[n % 10] : "");
            if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
            if (n < 1000000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
            if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " Million" + (n % 1000000 !== 0 ? " " + convert(n % 1000000) : "");
            return convert(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 !== 0 ? " " + convert(n % 1000000000) : "");
        };

        return convert(n) + " Only";
    };

    return `Rs. ${inWords(amount)}.`;
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function RetailSaleReceiptVoucherPrint({ voucher }: { voucher: ReceiptVoucher }) {
  const [printedAt, setPrintedAt] = useState<string>("");
  useEffect(() => {
    setPrintedAt(format(new Date(), "dd-MMM-yyyy hh:mm a"));
  }, []);

  const debitRows = voucher.details
    .filter((d) => Number(d.debit) > 0)
    .sort((a, b) => Number(b.debit) - Number(a.debit));
  const creditRows = voucher.details
    .filter((d) => Number(d.credit) > 0)
    .sort((a, b) => Number(b.credit) - Number(a.credit));
  const totalDebit = debitRows.reduce((s, d) => s + (Number(d.debit) || 0), 0) || Number(voucher.debitAmount) || 0;
  const totalCredit = creditRows.reduce((s, d) => s + (Number(d.credit) || 0), 0) || totalDebit;

  // Extract Outlet Tag Code if present
  const outletTag = voucher.details.find(d => d.tagAccountCode || d.tagAccountName);
  const outletCode = outletTag?.tagAccountCode || "";
  const outletName = outletTag?.tagAccountName || "";

  return (
    <div className="w-full max-w-[1000px] mx-auto bg-white text-black p-4 sm:p-6 font-sans print:p-0 print:max-w-none box-border text-[9px] sm:text-[10px]">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 10mm;
          }
          body {
            margin: 0;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-row-group;
          }
          .print-page-number::after {
            content: counter(page);
          }
        }
      `}} />

      {/* Table */}
      <table className="w-full text-[9px] sm:text-[10px] border-collapse table-fixed">
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[41%]" />
          <col className="w-[10.5%]" />
          <col className="w-[10.5%]" />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={4} className="font-normal text-left pb-1">
              {/* Header */}
              <div className="flex justify-between mb-1.5 gap-2 items-start text-black">
                {/* Logo */}
                <div className="w-[20%] flex flex-col items-start justify-center">
                   <img src="/image.png" alt="Logo" className="w-14 sm:w-18 print:w-20 object-contain" />
                </div>

                {/* Title */}
                <div className="w-[35%] flex flex-col justify-center">
                  <div className="bg-[#eef2f6] text-black w-full text-center py-1.5 print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact]">
                    <span className="text-base sm:text-lg font-extrabold underline decoration-2 underline-offset-2 tracking-wide">
                      Retail Sale Receipt
                    </span>
                    <br />
                    <span className="text-base sm:text-lg font-extrabold tracking-wide">Voucher (RSRV)</span>
                  </div>
                </div>

                {/* Details Box */}
                <div className="w-[45%] bg-[#f8fafc] text-[9px] sm:text-[10px] p-1 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
                   <div className="flex justify-between mb-0.5">
                     <span className="font-bold">Voucher Number:</span>
                     <span className="font-bold">{voucher.rvNo}</span>
                   </div>
                   <div className="flex justify-between">
                     <div className="flex gap-1.5">
                       <span className="font-bold">Date:</span>
                       <span>{voucher.rvDate ? format(new Date(voucher.rvDate), "dd/MM/yyyy") : ""}</span>
                     </div>
                     <div className="flex gap-1.5">
                       <span className="font-bold">Folio:</span>
                       <span>{voucher.folio || voucher.id.replace(/-/g, "").slice(-5).toUpperCase()}</span>
                     </div>
                   </div>
                   {(outletCode || outletName) && (
                     <div className="flex gap-1.5 mt-0.5 border-t border-gray-200 pt-0.5">
                       <span className="font-bold">Outlet:</span>
                       <span className="font-semibold text-blue-900">{outletCode ? `[${outletCode}] ` : ""}{outletName}</span>
                     </div>
                   )}
                </div>
              </div>
            </th>
          </tr>
          <tr className="border-y-2 border-black">
            <th className="py-0.5 pr-1 text-left font-bold">Account Code/Description</th>
            <th className="py-0.5 pr-1 text-left font-bold">Naration</th>
            <th className="py-0.5 pr-1 text-right font-bold">Debit</th>
            <th className="py-0.5 pr-1 text-right font-bold">Credit</th>
          </tr>
        </thead>
        <tbody>
          {/* Debit rows */}
          {debitRows.map((d, i) => {
            const r1 = d.refBillNo || voucher.refBillNo;
            const r2 = d.refBillNo2 || (voucher as any).refBillNo2;
            const taxableVal = (d as any).taxableValue;
            return (
              <tr key={`dr-${i}`} className="border-b border-gray-200 align-top">
                <td className="py-1 pr-1 align-top">
                  <div className="flex gap-1 sm:gap-1.5">
                    <span className="w-11 sm:w-14 shrink-0 font-bold">{d.accountCode}</span>
                    <span className="uppercase font-bold leading-tight">{d.accountName}</span>
                  </div>
                  {/* Tag Account */}
                  {(d.tagAccountCode || d.tagAccountName) && (
                     <div className="flex gap-1 sm:gap-1.5 mt-0.5">
                       <span className="w-11 sm:w-14 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                       <span className="uppercase text-gray-700 leading-tight">{d.tagAccountName}</span>
                     </div>
                  )}
                  {/* Ref# */}
                  {(r1 || r2) && (
                    <div className="flex gap-1 sm:gap-1.5 mt-0.5 text-[8px] text-gray-600">
                      <span className="w-11 sm:w-14 shrink-0 font-bold whitespace-nowrap">
                        Ref#
                      </span>
                      <span className="uppercase flex-1 leading-tight">
                        {r1 || ""}
                        {r1 && r2 ? " / " : ""}
                        {r2 || ""}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-1 pr-1 leading-tight text-gray-700 align-top">
                  <div className="break-words">{d.narration || voucher.description}</div>
                  {taxableVal && Number(taxableVal) > 0 ? (
                    <div className="text-[8px] text-gray-600 font-semibold mt-0.5">
                      Taxable: {fmt(Number(taxableVal))}
                    </div>
                  ) : null}
                </td>
                <td className="py-1 pr-1 text-right tabular-nums font-semibold align-top whitespace-nowrap">
                  {Number(d.debit) > 0 ? fmt(Number(d.debit)) : ""}
                </td>
                <td className="py-1 pr-1 text-right tabular-nums align-top">
                </td>
              </tr>
            );
          })}

          {/* Fallback debit row if empty */}
          {debitRows.length === 0 && voucher.debitAccountName && (
            <tr className="border-b border-gray-200 align-top">
              <td className="py-1 pr-1 align-top">
                <div className="flex gap-1 sm:gap-1.5">
                  <span className="w-11 sm:w-14 shrink-0 font-bold">{voucher.debitAccountCode}</span>
                  <span className="uppercase font-bold leading-tight">{voucher.debitAccountName}</span>
                </div>
              </td>
              <td className="py-1 pr-1 leading-tight text-gray-700 align-top">
                <div className="break-words">{voucher.description}</div>
              </td>
              <td className="py-1 pr-1 text-right tabular-nums font-semibold align-top whitespace-nowrap">
                {fmt(totalDebit)}
              </td>
              <td className="py-1 pr-1 text-right tabular-nums align-top">
              </td>
            </tr>
          )}

          {/* Credit rows */}
          {creditRows.map((d, i) => {
            const r1 = d.refBillNo || voucher.refBillNo;
            const r2 = d.refBillNo2 || (voucher as any).refBillNo2;
            const taxableVal = (d as any).taxableValue;
            return (
              <tr key={`cr-${i}`} className="border-b border-gray-200 align-top">
                <td className="py-1 pr-1 align-top">
                  <div className="flex gap-1 sm:gap-1.5">
                    <span className="w-11 sm:w-14 shrink-0 font-bold">{d.accountCode}</span>
                    <span className="uppercase font-bold leading-tight">{d.accountName}</span>
                  </div>
                  {(d.tagAccountCode || d.tagAccountName) && (
                     <div className="flex gap-1 sm:gap-1.5 mt-0.5">
                       <span className="w-11 sm:w-14 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                       <span className="uppercase text-gray-700 leading-tight">{d.tagAccountName}</span>
                     </div>
                  )}
                  {/* Ref# */}
                  {(r1 || r2) && (
                    <div className="flex gap-1 sm:gap-1.5 mt-0.5 text-[8px] text-gray-600">
                      <span className="w-11 sm:w-14 shrink-0 font-bold whitespace-nowrap">
                        Ref#
                      </span>
                      <span className="uppercase flex-1 leading-tight">
                        {r1 || ""}
                        {r1 && r2 ? " / " : ""}
                        {r2 || ""}
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-1 pr-1 leading-tight text-gray-700 align-top">
                  <div className="break-words">{d.narration || voucher.description}</div>
                  {taxableVal && Number(taxableVal) > 0 ? (
                    <div className="text-[8px] text-gray-600 font-semibold mt-0.5">
                      Taxable: {fmt(Number(taxableVal))}
                    </div>
                  ) : null}
                </td>
                <td className="py-1 pr-1 text-right tabular-nums align-top">
                </td>
                <td className="py-1 pr-1 text-right tabular-nums font-semibold align-top whitespace-nowrap">
                  {fmt(Number(d.credit))}
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          <tr className="border-t-2 border-black">
            <td colSpan={2} className="pt-1.5 pb-0.5 pr-2 align-bottom">
              <div className="flex gap-1.5 font-bold text-[9px] sm:text-[10px]">
                <span className="whitespace-nowrap">In Words:</span>
                <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(totalDebit)}</span>
              </div>
            </td>
            <td className="pt-1.5 pb-0.5 pr-1 text-right align-bottom">
              <div className="pb-px" style={{ borderTop: "1px solid black", borderBottom: "3px double black" }}>
                <span className="tabular-nums text-[9px] sm:text-[10px] block pt-px font-bold whitespace-nowrap">{fmt(totalDebit)}</span>
              </div>
            </td>
            <td className="pt-1.5 pb-0.5 pr-1 text-right align-bottom">
              <div className="pb-px" style={{ borderTop: "1px solid black", borderBottom: "3px double black" }}>
                <span className="tabular-nums text-[9px] sm:text-[10px] block pt-px font-bold whitespace-nowrap">{fmt(totalCredit)}</span>
              </div>
            </td>
          </tr>

          {/* Remarks + Signatures — kept together */}
          <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <td colSpan={4} className="pt-2 pb-0 font-normal text-left">
              {/* Remarks */}
              <div className="mt-2 mb-1.5">
                <div className="font-bold text-[10px] sm:text-[11px]">Remarks</div>
                <p className="text-[9px] mt-px text-gray-700">{voucher.description}</p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-black h-24 p-1 flex flex-col justify-start items-center">
                  <span className="text-[9px] font-bold text-center">PREPARED BY</span>
                </div>
                <div className="border border-black h-24 p-1 flex flex-col justify-start items-center">
                  <span className="text-[9px] font-bold text-center">CHECKED BY</span>
                </div>
                <div className="border border-black h-24 p-1 flex flex-col justify-start items-center">
                  <span className="text-[9px] font-bold text-center">APPROVED BY</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>

        {/* Page footer — repeated at the bottom of every printed page */}
        <tfoot className="display-table-row-group">
          <tr>
            <td colSpan={4} className="pt-3 pb-0 font-normal text-left">
              <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-gray-500 border-t border-gray-300 pt-1 mt-2">
                <div>
                  Printed At: <span className="font-semibold">{printedAt}</span>
                </div>
                <div className="font-semibold">
                  Page <span className="print-page-number"></span>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
