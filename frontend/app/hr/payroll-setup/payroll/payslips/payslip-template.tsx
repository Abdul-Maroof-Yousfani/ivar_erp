"use client";

import { format } from "date-fns";
import { Decimal } from "decimal.js";

interface PayslipTemplateProps {
    data: any;
}

export function PayslipTemplate({ data }: PayslipTemplateProps) {
    const { employee, payroll, pfBalances, loanBalances } = data;

    const salaryBreakup = data.salaryBreakup || [];
    const allowanceBreakup = data.allowanceBreakup || [];
    const deductionBreakup = data.deductionBreakup || [];

    // Calculate total allowances from breakup
    const totalAllowances = allowanceBreakup.reduce((sum: number, a: any) => sum + Number(a.amount), 0);

    return (
        <div className="bg-white p-8 w-full mx-auto border shadow-sm print:shadow-none print:border-none print:p-0 text-[12px] leading-tight font-sans">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-indigo-600 pb-4">
                <div>
                    <h1 className="text-2xl font-bold   text-indigo-700 italic">Speed (Pvt.) Limited</h1>
                </div>
                <div className="text-right">
                    <h2 className="text-lg font-bold">Employee Payslip for the month of {format(new Date(Number(payroll.year), Number(payroll.month) - 1), "MMMM yyyy")}</h2>
                    <p>Date: {format(new Date(), "dd-MM-yyyy")}</p>
                </div>
            </div>

            {/* Employee Info Grid */}
            <table className="w-full mb-6 border-collapse">
                <tbody>
                    <tr>
                        <td className="border p-1 bg-gray-50 font-bold w-1/6">Employee Name</td>
                        <td className="border p-1 w-1/4 uppercase">{employee.employeeName}</td>
                        <td className="border p-1 bg-gray-50 font-bold w-1/6">Father Name / Husband Name</td>
                        <td className="border p-1 uppercase">{employee.fatherHusbandName}</td>
                    </tr>
                    <tr>
                        <td className="border p-1 bg-gray-50 font-bold">Date of Joining</td>
                        <td className="border p-1">{format(new Date(employee.joiningDate), "dd-MMM-yyyy")}</td>
                        <td className="border p-1 bg-gray-50 font-bold">Employee Id</td>
                        <td className="border p-1">{employee.employeeId}</td>
                    </tr>
                    <tr>
                        <td className="border p-1 bg-gray-50 font-bold">Designation</td>
                        <td className="border p-1">{employee.designation?.name}</td>
                        <td className="border p-1 bg-gray-50 font-bold">Email Id</td>
                        <td className="border p-1">{employee.officialEmail}</td>
                    </tr>
                    <tr>
                        <td className="border p-1 bg-gray-50 font-bold">CNIC</td>
                        <td className="border p-1">{employee.cnicNumber}</td>
                        <td className="border p-1 bg-gray-50 font-bold">Grade</td>
                        <td className="border p-1">{employee.employeeGrade?.grade || "-"}</td>
                    </tr>
                    <tr>
                        <td className="border p-1 bg-gray-50 font-bold">Dept</td>
                        <td className="border p-1">{employee.department?.name}</td>
                        <td className="border p-1 bg-gray-50 font-bold">Sub Dept</td>
                        <td className="border p-1">{employee.subDepartment?.name || "-"}</td>
                    </tr>
                </tbody>
            </table>

            {/* PF and Loan Tables */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th colSpan={2} className="border p-1 text-center font-bold">Provident Fund</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border p-1">Opening Balance</td>
                                <td className="border p-1 text-right font-bold">{pfBalances.opening.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td className="border p-1">Added During the Month</td>
                                <td className="border p-1 text-right font-bold">{pfBalances.added.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td className="border p-1">Withdrawal Amount</td>
                                <td className="border p-1 text-right font-bold">{pfBalances.withdrawal.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="border p-1 font-bold">Closing Balance</td>
                                <td className="border p-1 text-right font-bold">{pfBalances.closing.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th colSpan={2} className="border p-1 text-center font-bold">Loan</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border p-1">Loan Amount</td>
                                <td className="border p-1 text-right font-bold">{loanBalances.totalAmount.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td className="border p-1">Paid Amount</td>
                                <td className="border p-1 text-right font-bold">{loanBalances.paidAmount.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td className="border p-1">Deducted During the Month</td>
                                <td className="border p-1 text-right font-bold">{loanBalances.deductedThisMonth.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="border p-1 font-bold">Closing Balance</td>
                                <td className="border p-1 text-right font-bold">{loanBalances.closingBalance.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payments and Deductions */}
            <div className="grid grid-cols-2 border border-gray-300 mb-6">
                {/* Payments Column */}
                <div className="border-r border-gray-300">
                    <div className="bg-gray-100 p-1 font-bold text-center border-b border-gray-300">Payments</div>
                    <table className="w-full text-[11px]">
                        <tbody>
                            {salaryBreakup.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="p-1 pl-2">{item.name}</td>
                                    <td className="p-1 pr-2 text-right font-bold">{Number(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}
                            {allowanceBreakup.length > 0 && (
                                <tr className="border-t">
                                    <td className="p-1 pl-2 font-semibold">Total Allowances ( {allowanceBreakup.map((a: any) => a.name).join(', ')} )</td>
                                    <td className="p-1 pr-2 text-right font-bold">{totalAllowances.toLocaleString()}</td>
                                </tr>
                            )}
                            {Number(data.overtimeAmount) > 0 && (
                                <tr className="border-t">
                                    <td className="p-1 pl-2">Overtime</td>
                                    <td className="p-1 pr-2 text-right font-bold">{Number(data.overtimeAmount).toLocaleString()}</td>
                                </tr>
                            )}
                            {Number(data.bonusAmount) > 0 && (
                                <tr className="border-t">
                                    <td className="p-1 pl-2">Bonus</td>
                                    <td className="p-1 pr-2 text-right font-bold">{Number(data.bonusAmount).toLocaleString()}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="bg-gray-50 p-1 font-bold flex justify-between border-t border-gray-300 mt-auto">
                        <span>Total Payment Rs.</span>
                        <span>{Number(data.grossSalary).toLocaleString()}</span>
                    </div>
                </div>

                {/* Deductions Column */}
                <div>
                    <div className="bg-gray-100 p-1 font-bold text-center border-b border-gray-300">Deduction</div>
                    <table className="w-full text-[11px]">
                        <tbody>
                            <tr>
                                <td className="p-1 pl-2">Provident Fund</td>
                                <td className="p-1 pr-2 text-right font-bold">{Number(data.providentFundDeduction).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td className="p-1 pl-2">EOBI</td>
                                <td className="p-1 pr-2 text-right font-bold">{Number(data.eobiDeduction).toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td className="p-1 pl-2">Income Tax</td>
                                <td className="p-1 pr-2 text-right font-bold">{Number(data.taxDeduction).toLocaleString()}</td>
                            </tr>
                            {Number(data.advanceSalaryDeduction) > 0 && (
                                <tr>
                                    <td className="p-1 pl-2">Advance Salary</td>
                                    <td className="p-1 pr-2 text-right font-bold">{Number(data.advanceSalaryDeduction).toLocaleString()}</td>
                                </tr>
                            )}
                            {Number(data.attendanceDeduction) > 0 && (
                                <tr>
                                    <td className="p-1 pl-2">Other Deductions ( S/Day, Absent )</td>
                                    <td className="p-1 pr-2 text-right font-bold">{Number(data.attendanceDeduction).toLocaleString()}</td>
                                </tr>
                            )}
                            {deductionBreakup.map((item: any) => (
                                <tr key={item.id}>
                                    <td className="p-1 pl-2">{item.name}</td>
                                    <td className="p-1 pr-2 text-right font-bold">{Number(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="bg-gray-50 p-1 font-bold flex justify-between border-t border-gray-300 mt-auto">
                        <span>Total Deduction Rs.</span>
                        <span>{Number(data.totalDeductions).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Net Payments */}
            <div className="border border-gray-400 p-2 font-bold mb-6 flex justify-between bg-white text-sm">
                <span className="uppercase tracking-widest text-indigo-800">Net Payments Rs</span>
                <span className="text-xl underline decoration-double">{Number(data.netSalary).toLocaleString()}</span>
            </div>

            {/* Bank Info */}
            <table className="w-full mb-12 border-collapse text-[11px]">
                <tbody>
                    <tr>
                        <td className="border p-1 w-1/4">Bank</td>
                        <td className="border p-1 w-3/4 font-semibold">{data.bankName || "-"}</td>
                    </tr>
                    <tr>
                        <td className="border p-1 w-1/4">Employee A/c No</td>
                        <td className="border p-1 w-3/4 font-semibold">{data.accountNumber || "-"}</td>
                    </tr>
                </tbody>
            </table>

            {/* Footer Note */}
            <div className="pt-8 text-center space-y-4">
                <p className="text-[10px] italic">Note : <span className="text-red-600">This is a system generated document and doesn't require any signature. Thank You !</span></p>
            </div>
        </div>
    );
}
