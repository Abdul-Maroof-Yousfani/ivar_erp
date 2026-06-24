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
            if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
            if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "");
            return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "");
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
    <div className="w-full max-w-[1000px] mx-auto bg-white text-black p-4 sm:p-6 font-sans print:p-0 print:max-w-none box-border text-[10px] sm:text-[11px]">
      {/* Header */}
      <div className="flex justify-between mb-4 gap-3 items-start">
        {/* Logo */}
        <div className="w-[20%] flex flex-col items-start justify-center">
           <img src="/image.png" alt="Logo" className="w-24 object-contain" />
        </div>
        
        {/* Title */}
        <div className="w-[35%] flex flex-col justify-center">
          <div className="bg-[#eef2f6] text-black w-full text-center py-1 text-base sm:text-lg font-bold print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact]">
            Journal Voucher
          </div>
        </div>

        {/* Details Box */}
        <div className="w-[45%] bg-[#f8fafc] text-[10px] sm:text-[11px] p-1.5 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
           <div className="flex justify-between mb-1">
             <span className="font-bold">Voucher Number:</span>
             <span className="font-bold">{voucher.jvNo}</span>
           </div>
           <div className="flex justify-between">
             <div className="flex gap-2">
               <span className="font-bold">Date:</span>
               <span>{voucher.jvDate ? format(new Date(voucher.jvDate), "dd/MM/yyyy") : ""}</span>
             </div>
             <div className="flex gap-2">
               <span className="font-bold">Folio:</span>
               <span>{voucher.id.replace(/-/g, "").slice(-5).toUpperCase()}</span>
             </div>
           </div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-[10px] sm:text-[11px] mb-3 border-collapse table-fixed">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-1.5 pr-1 text-left font-bold w-[40%]">Account Code/Description</th>
            <th className="py-1.5 pr-1 text-left font-bold w-[30%]">Naration</th>
            <th className="py-1.5 pr-1 text-right font-bold w-[15%]">Debit</th>
            <th className="py-1.5 text-right font-bold w-[15%]">Credit</th>
          </tr>
        </thead>
        <tbody>
          {debitRows.map((d, i) => (
            <tr key={`dr-${i}`} className="border-b border-gray-300 align-top">
              <td className="py-1.5 pr-1 overflow-hidden text-ellipsis">
                <div className="flex gap-1.5 sm:gap-3">
                  <span className="w-14 sm:w-20 shrink-0 font-medium">{d.accountCode}</span>
                  <span className="uppercase font-medium">{d.accountName}</span>
                </div>
                {/* Tag Account */}
                {(d.tagAccountCode || d.tagAccountName) && (
                   <div className="flex gap-1.5 sm:gap-3 mt-0.5">
                     <span className="w-14 sm:w-20 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                     <span className="uppercase text-gray-700">{d.tagAccountName}</span>
                   </div>
                )}
                {/* Ref# */}
                {(d.refBillNo || d.isTaxApplicable) && (
                  <div className="flex gap-1.5 sm:gap-3 mt-0.5">
                    <span className="w-14 sm:w-20 shrink-0 font-bold whitespace-nowrap">
                      Ref# {d.isTaxApplicable ? "TAXABLE" : ""}
                    </span>
                    <span className="uppercase">{d.refBillNo || "—"}</span>
                  </div>
                )}
              </td>
              <td className="py-1.5 pr-1 leading-tight">
                {d.narration || voucher.description}
              </td>
              <td className="py-1.5 pr-1 text-right tabular-nums font-semibold">
                {Number(d.debit) > 0 ? fmt(Number(d.debit)) : ""}
              </td>
              <td className="py-1.5 text-right tabular-nums">
              </td>
            </tr>
          ))}

          {creditRows.map((d, i) => (
            <tr key={`cr-${i}`} className="border-b border-gray-300 align-top">
              <td className="py-1.5 pr-1 overflow-hidden text-ellipsis">
                <div className="flex gap-1.5 sm:gap-3">
                  <span className="w-14 sm:w-20 shrink-0 font-medium">{d.accountCode}</span>
                  <span className="uppercase font-medium">{d.accountName}</span>
                </div>
                {(d.tagAccountCode || d.tagAccountName) && (
                   <div className="flex gap-1.5 sm:gap-3 mt-0.5">
                     <span className="w-14 sm:w-20 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                     <span className="uppercase text-gray-700">{d.tagAccountName}</span>
                   </div>
                )}
                {/* Ref# */}
                {(d.refBillNo || d.isTaxApplicable) && (
                  <div className="flex gap-1.5 sm:gap-3 mt-0.5">
                    <span className="w-14 sm:w-20 shrink-0 font-bold whitespace-nowrap">
                      Ref# {d.isTaxApplicable ? "TAXABLE" : ""}
                    </span>
                    <span className="uppercase">{d.refBillNo || "—"}</span>
                  </div>
                )}
              </td>
              <td className="py-1.5 pr-1 leading-tight">
                {d.narration || voucher.description}
              </td>
              <td className="py-1.5 pr-1 text-right tabular-nums">
              </td>
              <td className="py-1.5 text-right tabular-nums font-semibold">
                {fmt(Number(d.credit))}
              </td>
            </tr>
          ))}
        </tbody>
        
        <tfoot>
          <tr>
            <td colSpan={2} className="py-3 px-0 align-bottom border-b border-black">
              <div className="flex gap-2 font-bold text-[10px] sm:text-[11px]">
                <span className="whitespace-nowrap">In Words</span>
                <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(totalDebit)}</span>
              </div>
            </td>
            <td className="py-1.5 pr-1 text-right align-bottom border-b border-black">
              <div className="ml-auto border-t border-black pb-0.5" style={{ borderBottom: '3px double black' }}>
                <span className="tabular-nums text-[10px] sm:text-[11px] block pt-0.5 font-bold">{fmt(totalDebit)}</span>
              </div>
            </td>
            <td className="py-1.5 px-0 text-right align-bottom border-b border-black">
              <div className="ml-auto border-t border-black pb-0.5" style={{ borderBottom: '3px double black' }}>
                <span className="tabular-nums text-[10px] sm:text-[11px] block pt-0.5 font-bold">{fmt(totalCredit)}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Remarks */}
      <div className="mt-3 mb-6">
        <div className="font-bold text-[11px] sm:text-[12px]">Remarks</div>
        <p className="text-[10px] mt-0.5 text-gray-700">{voucher.description}</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-black h-14 p-1.5 flex flex-col justify-start items-center">
          <span className="text-[9px] font-bold text-center">PREPARED BY</span>
        </div>
        <div className="border border-black h-14 p-1.5 flex flex-col justify-start items-center">
          <span className="text-[9px] font-bold text-center">CHECKED BY</span>
        </div>
        <div className="border border-black h-14 p-1.5 flex flex-col justify-start items-center">
          <span className="text-[9px] font-bold text-center">APPROVED BY</span>
        </div>
      </div>

    </div>
  );
}
