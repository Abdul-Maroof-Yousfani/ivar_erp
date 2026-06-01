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

export function ReceiptVoucherPrint({ voucher }: { voucher: ReceiptVoucher }) {
  const isBank = voucher.type === "bank";
  const debitRows = voucher.details.filter((d) => Number(d.debit) > 0);
  const creditRows = voucher.details.filter((d) => Number(d.credit) > 0);
  const totalDebit = debitRows.reduce((s, d) => s + (Number(d.debit) || 0), 0) || Number(voucher.debitAmount) || 0;
  const totalCredit = creditRows.reduce((s, d) => s + (Number(d.credit) || 0), 0) || totalDebit;

  return (
    <div className="w-full max-w-[1000px] mx-auto bg-white text-black p-8 font-sans print:p-8 print:max-w-none box-border">
      {/* Header */}
      <div className="flex justify-between mb-6 gap-4 items-start">
        {/* Logo */}
        <div className="w-[20%] flex flex-col items-start justify-center">
           <img src="/image.png" alt="Logo" className="w-32 object-contain" />
        </div>
        
        {/* Title */}
        <div className="w-[35%] flex flex-col justify-center">
          <div className="bg-[#eef2f6] text-black w-full text-center py-2 text-xl sm:text-xl font-bold print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact]">
            {isBank ? "Bank" : "Cash"} Receipt Voucher
          </div>
        </div>

        {/* Details Box */}
        <div className="w-[45%] bg-[#f8fafc] text-xs sm:text-[13px] p-2 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col justify-center">
           <div className="flex justify-between mb-2">
             <span className="font-bold">Voucher Number:</span>
             <span className="font-bold">{voucher.rvNo}</span>
           </div>
           <div className="flex justify-between">
             <div className="flex gap-2">
               <span className="font-bold">Date:</span>
               <span>{voucher.rvDate ? format(new Date(voucher.rvDate), "dd/MM/yyyy") : ""}</span>
             </div>
             <div className="flex gap-2">
               <span className="font-bold">Folio:</span>
               <span>{voucher.id.replace(/-/g, "").slice(-5).toUpperCase()}</span>
             </div>
           </div>
           {isBank && (
             <div className="flex gap-2 mt-2">
               <span className="font-bold">Cheque #:</span>
               <span className="uppercase">{voucher.chequeNo || "—"}</span>
             </div>
           )}
        </div>
      </div>

      {/* Table */}
      <table className="w-full text-xs sm:text-[13px] mb-4 border-collapse table-fixed">
        <thead>
          <tr className="border-y-2 border-black">
            <th className="py-2 pr-2 text-left font-bold w-[40%]">Account Code/Description</th>
            <th className="py-2 pr-2 text-left font-bold w-[30%]">Naration</th>
            <th className="py-2 pr-2 text-right font-bold w-[15%]">Debit</th>
            <th className="py-2 text-right font-bold w-[15%]">Credit</th>
          </tr>
        </thead>
        <tbody>
          {/* Debit rows */}
          {debitRows.map((d, i) => (
            <tr key={`dr-${i}`} className="border-b border-gray-300 align-top">
              <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                <div className="flex gap-2 sm:gap-4">
                  <span className="w-16 sm:w-24 shrink-0 font-medium">{d.accountCode}</span>
                  <span className="uppercase font-medium">{d.accountName}</span>
                </div>
                {/* Tag Account */}
                {(d.tagAccountCode || d.tagAccountName) && (
                   <div className="flex gap-2 sm:gap-4 mt-1">
                     <span className="w-16 sm:w-24 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                     <span className="uppercase text-gray-700">{d.tagAccountName}</span>
                   </div>
                )}
              </td>
              <td className="py-2 pr-2 leading-tight">
                {d.narration || voucher.description}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {Number(d.debit) > 0 ? fmt(Number(d.debit)) : ""}
              </td>
              <td className="py-2 text-right tabular-nums">
              </td>
            </tr>
          ))}

          {/* Fallback debit row if empty */}
          {debitRows.length === 0 && voucher.debitAccountName && (
            <tr className="border-b border-gray-300 align-top">
              <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                <div className="flex gap-2 sm:gap-4">
                  <span className="w-16 sm:w-24 shrink-0 font-medium">{voucher.debitAccountCode}</span>
                  <span className="uppercase font-medium">{voucher.debitAccountName}</span>
                </div>
              </td>
              <td className="py-2 pr-2 leading-tight">
                {voucher.description}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {fmt(totalDebit)}
              </td>
              <td className="py-2 text-right tabular-nums">
              </td>
            </tr>
          )}

          {/* Credit rows */}
          {creditRows.map((d, i) => (
            <tr key={`cr-${i}`} className="border-b border-gray-300 align-top">
              <td className="py-2 pr-2 overflow-hidden text-ellipsis">
                <div className="flex gap-2 sm:gap-4">
                  <span className="w-16 sm:w-24 shrink-0 font-medium">{d.accountCode}</span>
                  <span className="uppercase font-medium">{d.accountName}</span>
                </div>
                {(d.tagAccountCode || d.tagAccountName) && (
                   <div className="flex gap-2 sm:gap-4 mt-1">
                     <span className="w-16 sm:w-24 shrink-0 font-medium text-gray-700">{d.tagAccountCode}</span>
                     <span className="uppercase text-gray-700">{d.tagAccountName}</span>
                   </div>
                )}
                {/* Ref# */}
                {(d.refBillNo || voucher.refBillNo || d.isTaxApplicable || voucher.isTaxApplicable) && (
                  <div className="flex gap-2 sm:gap-4 mt-1">
                    <span className="w-16 sm:w-24 shrink-0 font-bold whitespace-nowrap">
                      Ref# {(d.isTaxApplicable ?? voucher.isTaxApplicable) ? "TAXABLE" : ""}
                    </span>
                    <span className="uppercase">{d.refBillNo || voucher.refBillNo}</span>
                  </div>
                )}
              </td>
              <td className="py-2 pr-2 leading-tight">
                {d.narration || voucher.description}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
              </td>
              <td className="py-2 text-right tabular-nums">
                {fmt(Number(d.credit))}
              </td>
            </tr>
          ))}
        </tbody>
        
        <tfoot>
          <tr>
            <td colSpan={2} className="py-4 px-0 align-bottom border-b border-black">
              <div className="flex gap-2 font-bold text-xs sm:text-[13px]">
                <span className="whitespace-nowrap">In Words</span>
                <span className="underline decoration-1 underline-offset-2 break-words">{numberToWords(totalDebit)}</span>
              </div>
            </td>
            <td className="py-2 pr-2 text-right align-bottom border-b border-black">
              <div className="ml-auto border-t border-black pb-0.5" style={{ borderBottom: '3px double black' }}>
                <span className="tabular-nums text-xs sm:text-[13px] block pt-0.5">{fmt(totalDebit)}</span>
              </div>
            </td>
            <td className="py-2 px-0 text-right align-bottom border-b border-black">
              <div className="ml-auto border-t border-black pb-0.5" style={{ borderBottom: '3px double black' }}>
                <span className="tabular-nums text-xs sm:text-[13px] block pt-0.5">{fmt(totalCredit)}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Remarks */}
      <div className="mt-4 mb-8">
        <div className="font-bold text-xs sm:text-[14px]">Remarks</div>
        <p className="text-xs sm:text-[13px] mt-1 text-gray-700">{voucher.description}</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-black h-20 p-2 flex flex-col justify-start items-center">
          <span className="text-[10px] sm:text-[11px] font-bold text-center">PREPARED BY</span>
        </div>
        <div className="border border-black h-20 p-2 flex flex-col justify-start items-center">
          <span className="text-[10px] sm:text-[11px] font-bold text-center">CHECKED BY</span>
        </div>
        <div className="border border-black h-20 p-2 flex flex-col justify-start items-center">
          <span className="text-[10px] sm:text-[11px] font-bold text-center">APPROVED BY</span>
        </div>
      </div>

    </div>
  );
}
