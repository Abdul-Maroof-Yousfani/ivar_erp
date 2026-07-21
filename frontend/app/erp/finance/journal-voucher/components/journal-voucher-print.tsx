import { JournalVoucher } from "@/lib/actions/journal-voucher";
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

export function JournalVoucherPrint({ voucher }: { voucher: JournalVoucher }) {
  const debitRows = voucher.details.filter((d) => Number(d.debit) > 0);
  const creditRows = voucher.details.filter((d) => Number(d.credit) > 0);
  const totalDebit = debitRows.reduce((s, d) => s + (Number(d.debit) || 0), 0);
  const totalCredit = creditRows.reduce((s, c) => s + (Number(c.credit) || 0), 0);

  return (
    <div className="w-full max-w-[1000px] mx-auto bg-white text-black p-4 sm:p-6 font-sans print:p-0 print:max-w-none box-border text-[9px] sm:text-[10px]">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin: 0;
          }
          @page :not(:first) {
            margin-top: 1.5cm;
          }
          body {
            margin: 0.7cm;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: none;
          }
        }
      `}} />

      {/* Header */}
      <div className="flex justify-between mb-1.5 gap-2 items-start">
        {/* Logo */}
        <div className="w-[20%] flex flex-col items-start justify-center">
           <img src="/image.png" alt="Logo" className="w-14 sm:w-18 print:w-20 object-contain" />
        </div>

        {/* Title */}
        <div className="w-[35%] flex flex-col justify-center">
          <div className="bg-[#eef2f6] text-black w-full text-center py-1.5 print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact]">
            <span className="text-base sm:text-lg font-extrabold underline decoration-2 underline-offset-2 tracking-wide">
              Journal
            </span>
            <br />
            <span className="text-base sm:text-lg font-extrabold tracking-wide">Voucher</span>
          </div>
        </div>

        {/* Details Box */}
        <div className="w-[45%] bg-[#f8fafc] text-[9px] sm:text-[10px] p-1 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
           <div className="flex justify-between mb-0.5">
             <span className="font-bold">Voucher Number:</span>
             <span className="font-bold">{voucher.jvNo}</span>
           </div>
           <div className="flex justify-between">
             <div className="flex gap-1.5">
               <span className="font-bold">Date:</span>
               <span>{voucher.jvDate ? format(new Date(voucher.jvDate), "dd/MM/yyyy") : ""}</span>
             </div>
             <div className="flex gap-1.5">
               <span className="font-bold">Folio:</span>
               <span>{voucher.folio || voucher.id.replace(/-/g, "").slice(-5).toUpperCase()}</span>
             </div>
           </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-[9px] sm:text-[10px] border-collapse table-fixed">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-0.5 pr-1 text-left font-bold w-[38%]">Account Code/Description</th>
            <th className="py-0.5 pr-1 text-left font-bold w-[28%]">Naration</th>
            <th className="py-0.5 pr-1 text-right font-bold w-[10%]">Taxable</th>
            <th className="py-0.5 pr-1 text-right font-bold w-[12%]">Debit</th>
            <th className="py-0.5 text-right font-bold w-[12%]">Credit</th>
          </tr>
        </thead>
        <tbody>
          {debitRows.map((d, i) => {
            const r1 = d.refBillNo || voucher.refBillNo;
            const r2 = d.refBillNo2 || (voucher as any).refBillNo2;
            const tType = d.taxType || voucher.taxType;
            const taxableVal = (d as any).taxableValue;
            return (
              <tr key={`dr-${i}`} className="border-b border-gray-200 align-top">
                <td className="py-px pr-1 overflow-hidden text-ellipsis">
                  <div className="flex gap-1 sm:gap-2">
                    <span className="w-12 sm:w-16 shrink-0 font-bold">{d.accountCode}</span>
                    <span className="uppercase font-bold">{d.accountName}</span>
                  </div>
                  {/* Tag Account */}
                  {(d.tagAccountCode || d.tagAccountName) && (
                     <div className="flex gap-1 sm:gap-2 mt-px">
                       <span className="w-12 sm:w-16 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                       <span className="uppercase text-gray-700">{d.tagAccountName}</span>
                     </div>
                  )}
                  {/* Ref# / taxType / taxable */}
                  {(r1 || r2 || tType || taxableVal) && (
                    <div className="flex gap-1 sm:gap-2 mt-px text-[8px] text-gray-600">
                      <span className="w-12 sm:w-16 shrink-0 font-bold whitespace-nowrap">
                        Ref# {tType ? tType : ""}
                      </span>
                      <span className="uppercase flex-1">
                        {r1 || ""}
                        {r1 && r2 ? " / " : ""}
                        {r2 || ""}
                      </span>
                      {taxableVal && (
                        <span className="font-semibold whitespace-nowrap">
                          Txbl: {fmt(Number(taxableVal))}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-px pr-1 leading-tight text-gray-700">
                  {d.narration || voucher.description}
                </td>
                <td className="py-px pr-1 text-right tabular-nums text-gray-600">
                  {taxableVal ? fmt(Number(taxableVal)) : ""}
                </td>
                <td className="py-px pr-1 text-right tabular-nums font-semibold">
                  {Number(d.debit) > 0 ? fmt(Number(d.debit)) : ""}
                </td>
                <td className="py-px text-right tabular-nums">
                </td>
              </tr>
            );
          })}

          {creditRows.map((d, i) => {
            const r1 = d.refBillNo || voucher.refBillNo;
            const r2 = d.refBillNo2 || (voucher as any).refBillNo2;
            const tType = d.taxType || voucher.taxType;
            const taxableVal = (d as any).taxableValue;
            return (
              <tr key={`cr-${i}`} className="border-b border-gray-200 align-top">
                <td className="py-px pr-1 overflow-hidden text-ellipsis">
                  <div className="flex gap-1 sm:gap-2">
                    <span className="w-12 sm:w-16 shrink-0 font-bold">{d.accountCode}</span>
                    <span className="uppercase font-bold">{d.accountName}</span>
                  </div>
                  {(d.tagAccountCode || d.tagAccountName) && (
                     <div className="flex gap-1 sm:gap-2 mt-px">
                       <span className="w-12 sm:w-16 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                       <span className="uppercase text-gray-700">{d.tagAccountName}</span>
                     </div>
                  )}
                  {/* Ref# / taxType / taxable */}
                  {(r1 || r2 || tType || taxableVal) && (
                    <div className="flex gap-1 sm:gap-2 mt-px text-[8px] text-gray-600">
                      <span className="w-12 sm:w-16 shrink-0 font-bold whitespace-nowrap">
                        Ref# {tType ? tType : ""}
                      </span>
                      <span className="uppercase flex-1">
                        {r1 || ""}
                        {r1 && r2 ? " / " : ""}
                        {r2 || ""}
                      </span>
                      {taxableVal && (
                        <span className="font-semibold whitespace-nowrap">
                          Txbl: {fmt(Number(taxableVal))}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="py-px pr-1 leading-tight text-gray-700">
                  {d.narration || voucher.description}
                </td>
                <td className="py-px pr-1 text-right tabular-nums text-gray-600">
                  {taxableVal ? fmt(Number(taxableVal)) : ""}
                </td>
                <td className="py-px pr-1 text-right tabular-nums">
                </td>
                <td className="py-px text-right tabular-nums font-semibold">
                  {fmt(Number(d.credit))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals row — outside table so it only appears once at the very end */}
      <div className="w-full border-t-2 border-black mt-0">
        <div className="flex items-start">
          <div className="flex-1 py-0.5 pr-2">
            <div className="flex gap-1.5 font-bold text-[9px] sm:text-[10px]">
              <span className="whitespace-nowrap">In Words</span>
              <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(totalDebit)}</span>
            </div>
          </div>
          {/* Taxable total spacer */}
          <div className="w-[10%]" />
          {/* Debit total */}
          <div className="w-[12%] py-px pr-1 text-right">
            <div className="border-t border-black pb-px" style={{ borderBottom: '3px double black' }}>
              <span className="tabular-nums text-[9px] sm:text-[10px] block pt-px font-bold">{fmt(totalDebit)}</span>
            </div>
          </div>
          {/* Credit total */}
          <div className="w-[12%] py-px text-right">
            <div className="border-t border-black pb-px" style={{ borderBottom: '3px double black' }}>
              <span className="tabular-nums text-[9px] sm:text-[10px] block pt-px font-bold">{fmt(totalCredit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Remarks + Signatures — kept together, never split across pages */}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        {/* Remarks */}
        <div className="mt-1 mb-1.5">
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
      </div>

    </div>
  );
}
