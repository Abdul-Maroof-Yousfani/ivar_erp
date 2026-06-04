import { TrialBalanceResult } from "@/lib/actions/finance-reports";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface TrialBalancePrintProps {
  data: TrialBalanceResult;
  reportType: "OPENING" | "CLOSING" | "DETAILED";
  includeTagAccounts: boolean;
}

export function TrialBalancePrint({ data, reportType, includeTagAccounts }: TrialBalancePrintProps) {
  const rows = data.rows || [];
  const showOpening = reportType === "OPENING" || reportType === "DETAILED";
  const showTransactions = reportType === "DETAILED";
  const showClosing = reportType === "CLOSING" || reportType === "DETAILED";

  const totalCols = 3 
    + (showOpening ? 2 : 0) 
    + (showTransactions ? 2 : 0) 
    + (showClosing ? 2 : 0);

  return (
    <div className="w-full bg-white text-black p-8 font-sans print:p-0 box-border text-[11px]">
      {/* Premium Header */}
      <div className="flex justify-between items-start mb-8 pb-4 border-b border-black">
        {/* Company Logo Section */}
        <div className="w-[25%] flex flex-col justify-center">
          <img src="/image-v2.png" alt="Company Logo" className="w-32 object-contain error-fallback" onError={(e) => {
            // Fallback text if logo is not found
            (e.target as HTMLElement).style.display = 'none';
          }} />
          <h2 className="text-sm font-bold tracking-tight mt-1">SPEED LIMIT</h2>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider">Financial Report</p>
        </div>

        {/* Report Title */}
        <div className="w-[45%] text-center">
          <div className="bg-[#f1f5f9] border border-gray-300 py-3 px-4 rounded">
            <h1 className="text-lg font-bold tracking-widest text-gray-900 uppercase">Trial Balance</h1>
            <p className="text-[10px] text-gray-600 font-semibold mt-1">
              {data.from && data.to
                ? `Period: ${format(new Date(data.from), "dd MMM yyyy")} – ${format(new Date(data.to), "dd MMM yyyy")}`
                : "All-Time Statement (Running Balances)"}
            </p>
          </div>
        </div>

        {/* Info / Metadata Box */}
        <div className="w-[28%] bg-[#f8fafc] p-3 border border-gray-300 rounded text-[10px] leading-relaxed">
          <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
            <span className="font-bold text-gray-600">Printed On:</span>
            <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
            <span className="font-bold text-gray-600">Format Type:</span>
            <span className="font-semibold uppercase text-primary">{reportType}</span>
          </div>
          <div className="flex justify-between border-b border-gray-200 pb-1 mb-1">
            <span className="font-bold text-gray-600">Sub-Accounts:</span>
            <span>{includeTagAccounts ? "Included" : "Excluded"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-gray-600">Status:</span>
            <span className={cn("font-bold uppercase", data.balanced ? "text-green-700" : "text-red-700")}>
              {data.balanced ? "✓ Balanced" : "⚠ Unbalanced"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Trial Balance Table */}
      <table className="w-full border-collapse border border-gray-400">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-400">
            <th rowSpan={2} className="border border-gray-400 text-center py-2 font-bold uppercase w-[5%]">Sr.</th>
            <th rowSpan={2} className="border border-gray-400 text-center py-2 font-bold uppercase w-[12%]">Code</th>
            <th rowSpan={2} className="border border-gray-400 text-left px-3 py-2 font-bold uppercase w-[33%]">Account Description</th>
            {showOpening && <th colSpan={2} className="border border-gray-400 text-center py-1 font-bold uppercase">Opening Balance</th>}
            {showTransactions && <th colSpan={2} className="border border-gray-400 text-center py-1 font-bold uppercase">Transactions</th>}
            {showClosing && <th colSpan={2} className="border border-gray-400 text-center py-1 font-bold uppercase">Closing Balance</th>}
          </tr>
          <tr className="bg-gray-50 border-b border-gray-400">
            {showOpening && (
              <>
                <th className="border border-gray-400 text-right px-2 py-1.5 font-semibold text-[9px] uppercase w-[8%]">DR</th>
                <th className="border border-gray-400 text-right px-2 py-1.5 font-semibold text-[9px] uppercase w-[8%]">CR</th>
              </>
            )}
            {showTransactions && (
              <>
                <th className="border border-gray-400 text-right px-2 py-1.5 font-semibold text-[9px] uppercase w-[8%]">DR</th>
                <th className="border border-gray-400 text-right px-2 py-1.5 font-semibold text-[9px] uppercase w-[8%]">CR</th>
              </>
            )}
            {showClosing && (
              <>
                <th className="border border-gray-400 text-right px-2 py-1.5 font-semibold text-[9px] uppercase w-[8%]">DR</th>
                <th className="border border-gray-400 text-right px-2 py-1.5 font-semibold text-[9px] uppercase w-[8%]">CR</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="text-center py-8 text-gray-500 font-semibold italic border border-gray-400">
                No ledger account balances to report.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const isGroup = row.isGroup;
              const isTag = row.isTagAccount;
              const level = row.level || 0;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-gray-300 align-middle",
                    isGroup && "font-bold bg-gray-50/50",
                    isTag && "text-gray-600 bg-gray-50/20 italic"
                  )}
                >
                  <td className="border border-gray-300 text-center py-1.5 font-mono text-[10px]">{i + 1}</td>
                  <td className="border border-gray-300 text-center py-1.5 font-mono text-[10px]">{row.code}</td>
                  <td className="border border-gray-300 px-3 py-1.5">
                    <div
                      className={cn("flex items-center")}
                      style={{ paddingLeft: `${level * 1.2}rem` }}
                    >
                      {isTag ? `↳ ${row.name}` : row.name}
                    </div>
                  </td>
                  {showOpening && (
                    <>
                      <td className="border border-gray-300 text-right px-2 py-1.5 font-mono text-[10px] tabular-nums">
                        {row.openingDebit > 0 ? fmt(row.openingDebit) : ""}
                      </td>
                      <td className="border border-gray-300 text-right px-2 py-1.5 font-mono text-[10px] tabular-nums">
                        {row.openingCredit > 0 ? fmt(row.openingCredit) : ""}
                      </td>
                    </>
                  )}
                  {showTransactions && (
                    <>
                      <td className="border border-gray-300 text-right px-2 py-1.5 font-mono text-[10px] tabular-nums">
                        {row.transactionDebit > 0 ? fmt(row.transactionDebit) : ""}
                      </td>
                      <td className="border border-gray-300 text-right px-2 py-1.5 font-mono text-[10px] tabular-nums">
                        {row.transactionCredit > 0 ? fmt(row.transactionCredit) : ""}
                      </td>
                    </>
                  )}
                  {showClosing && (
                    <>
                      <td className="border border-gray-300 text-right px-2 py-1.5 font-mono text-[10px] tabular-nums">
                        {row.closingDebit > 0 ? fmt(row.closingDebit) : ""}
                      </td>
                      <td className="border border-gray-300 text-right px-2 py-1.5 font-mono text-[10px] tabular-nums">
                        {row.closingCredit > 0 ? fmt(row.closingCredit) : ""}
                      </td>
                    </>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold border-t-2 border-black text-[11px]">
            <td colSpan={3} className="border border-gray-400 text-right px-3 py-2 uppercase tracking-wide">Grand Total</td>
            {showOpening && (
              <>
                <td className="border border-gray-400 text-right px-2 py-2 font-mono tabular-nums">{fmt(data.totalOpeningDebit ?? 0)}</td>
                <td className="border border-gray-400 text-right px-2 py-2 font-mono tabular-nums">{fmt(data.totalOpeningCredit ?? 0)}</td>
              </>
            )}
            {showTransactions && (
              <>
                <td className="border border-gray-400 text-right px-2 py-2 font-mono tabular-nums">{fmt(data.totalTransactionDebit ?? 0)}</td>
                <td className="border border-gray-400 text-right px-2 py-2 font-mono tabular-nums">{fmt(data.totalTransactionCredit ?? 0)}</td>
              </>
            )}
            {showClosing && (
              <>
                <td className="border border-gray-400 text-right px-2 py-2 font-mono tabular-nums">{fmt(data.totalClosingDebit ?? data.totalDebit ?? 0)}</td>
                <td className="border border-gray-400 text-right px-2 py-2 font-mono tabular-nums">{fmt(data.totalClosingCredit ?? data.totalCredit ?? 0)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>

      {/* Balanced Banner (Print-safe style) */}
      {!data.balanced && (
        <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded text-red-800 font-bold flex justify-between">
          <span>⚠ WARNING: Trial Balance is NOT balanced. Please review transactions for ledger discrepancies.</span>
          <span>Difference: {fmt(Math.abs((data.totalDebit ?? 0) - (data.totalCredit ?? 0)))}</span>
        </div>
      )}

      {/* Signature Sections */}
      <div className="grid grid-cols-3 gap-6 mt-12 print:mt-16">
        <div className="border border-gray-400 rounded h-20 p-2 flex flex-col justify-between items-center bg-gray-50/10">
          <span className="text-[9px] font-bold text-gray-500 uppercase">PREPARED BY</span>
          <div className="w-[80%] border-t border-gray-400 mb-1"></div>
        </div>
        <div className="border border-gray-400 rounded h-20 p-2 flex flex-col justify-between items-center bg-gray-50/10">
          <span className="text-[9px] font-bold text-gray-500 uppercase">CHECKED BY</span>
          <div className="w-[80%] border-t border-gray-400 mb-1"></div>
        </div>
        <div className="border border-gray-400 rounded h-20 p-2 flex flex-col justify-between items-center bg-gray-50/10">
          <span className="text-[9px] font-bold text-gray-500 uppercase">APPROVED BY</span>
          <div className="w-[80%] border-t border-gray-400 mb-1"></div>
        </div>
      </div>
    </div>
  );
}
