"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import { getBankReport } from "@/lib/actions/payroll";
import { Bank } from "@/lib/actions/bank";
import { format } from "date-fns";
import { Autocomplete } from "@/components/ui/autocomplete";

import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { DatePicker } from "@/components/ui/date-picker";

interface BankReportContentProps {
    initialBanks: Bank[];
}

export function BankReportContent({ initialBanks }: BankReportContentProps) {
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<any[]>([]);
    const [filters, setFilters] = useState({
        monthYear: format(new Date(), "yyyy-MM"),
        chequeDate: format(new Date(), "yyyy-MM-dd"),
        bankName: "",
    });

    const handleSearch = () => {
        if (!filters.bankName) {
            toast.error("Please select a bank");
            return;
        }

        startTransition(async () => {
            const [year, month] = filters.monthYear.split("-");
            const result = await getBankReport({
                month,
                year,
                bankName: filters.bankName,
            });

            if (result.status) {
                setData(result.data);
                if (result.data.length === 0) {
                    toast.info("No records found for the selected criteria.");
                }
            } else {
                toast.error(result.message);
            }
        });
    };

    const totalAmount = useMemo(() => {
        return data.reduce((sum, item) => sum + (Number(item.netSalary) || 0), 0);
    }, [data]);

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        if (data.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = ["S.NO", "NAME", "ACCOUNT NO.", "AMOUNT RS."];
        const rows = data.map((item, index) => [
            index + 1,
            item.employee.employeeName,
            item.accountNumber || "N/A",
            item.netSalary,
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(",")),
            ["", "TOTAL:", "", totalAmount]
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bank_report_${filters.bankName}_${filters.monthYear}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formattedMonthYear = useMemo(() => {
        const [year, month] = filters.monthYear.split("-");
        const date = new Date(Number(year), Number(month) - 1);
        return format(date, "MMMM yyyy");
    }, [filters.monthYear]);

    return (
        <div className="space-y-6">
            <Card className="print:hidden">
                <CardHeader>
                    <CardTitle>View Bank Report Form</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="min-w-[200px] flex-1">
                            <label className="text-sm font-medium mb-2 block">Month-Year</label>
                            <MonthYearPicker
                                value={filters.monthYear}
                                onChange={(val) => setFilters({ ...filters, monthYear: Array.isArray(val) ? val[0] : val })}
                            />
                        </div>
                        <div className="min-w-[200px] flex-1">
                            <label className="text-sm font-medium mb-2 block">Cheque Date</label>
                            <DatePicker
                                value={filters.chequeDate}
                                onChange={(val) => setFilters({ ...filters, chequeDate: val })}
                            />
                        </div>
                        <div className="min-w-[250px] flex-1">
                            <label className="text-sm font-medium mb-2 block">Select Bank <span className="text-red-500">*</span></label>
                            <Autocomplete
                                options={initialBanks.map(bank => ({ value: bank.name, label: bank.name }))}
                                value={filters.bankName}
                                onValueChange={(value) => setFilters({ ...filters, bankName: value || "" })}
                                placeholder="Select Bank"
                                searchPlaceholder="Search bank..."
                            />
                        </div>
                        <div className="flex gap-2 min-w-fit">
                            <Button onClick={handleSearch} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700">
                                <Search className="h-4 w-4 mr-2" />
                                Search
                            </Button>
                            <Button variant="outline" onClick={handlePrint}>
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                            <Button variant="outline" onClick={handleExportCSV}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Export CSV
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="print:shadow-none print:border-none">
                <CardContent className="p-8 print:p-0">
                    <div className="max-w-4xl mx-auto space-y-8 text-sm">
                        {/* Header Info */}
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p>Date: {format(new Date(filters.chequeDate), "MMMM dd, yyyy")}</p>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="font-bold text-base underline">The Manager</p>
                            <p className="font-bold">{filters.bankName || "[Bank Name]"}</p>
                            <p>[Branch Address Placeholder]</p>
                            <p>[City Placeholder]</p>
                        </div>

                        <div className="text-center">
                            <p className="font-bold text-lg underline">Subject: Transfer Salary</p>
                        </div>

                        <div className="space-y-4">
                            <p>Dear Sir,</p>
                            <p>
                                You are authorized to transfer the salary for the Month of <strong>{formattedMonthYear}</strong> into the following accounts:
                            </p>
                        </div>

                        {/* Salary Table */}
                        <table className="w-full border-collapse border border-gray-300">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="border border-gray-300 px-4 py-2 text-left w-16">S. NO.</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left">NAME</th>
                                    <th className="border border-gray-300 px-4 py-2 text-left">ACCOUNT NO.</th>
                                    <th className="border border-gray-300 px-4 py-2 text-right">AMOUNT RS.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((item, index) => (
                                    <tr key={item.id}>
                                        <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                                        <td className="border border-gray-300 px-4 py-2 uppercase">{item.employee.employeeName}</td>
                                        <td className="border border-gray-300 px-4 py-2 font-mono">{item.accountNumber || "N/A"}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-right">{Number(item.netSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                                {data.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="border border-gray-300 px-4 py-8 text-center text-gray-400">
                                            No records found. Select criteria and click Search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="font-bold">
                                <tr>
                                    <td colSpan={3} className="border border-gray-300 px-4 py-2 text-right">TOTAL:</td>
                                    <td className="border border-gray-300 px-4 py-2 text-right underline decoration-double">
                                        {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>

                        {/* Signature Section */}
                        <div className="pt-24 flex justify-between">
                            <div className="w-64 border-t border-black text-center pt-2">
                                <p className="font-bold">Authorized Signatory</p>
                            </div>
                            <div className="w-64 border-t border-black text-center pt-2">
                                <p className="font-bold">Authorized Signatory</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\:hidden {
            display: none !important;
          }
          .print\:shadow-none {
            box-shadow: none !important;
          }
          .print\:border-none {
            border: none !important;
          }
          .p-8.print\:p-0 {
            padding: 0 !important;
          }
          .max-w-4xl {
            max-width: 100% !important;
          }
          .CardContent-root, .p-8 {
             padding: 0 !important;
          }
          .space-y-6 > :not(.print\:shadow-none) {
             display: none;
          }
          .print\:shadow-none, .print\:shadow-none * {
            visibility: visible;
          }
          .print\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
        </div>
    );
}
