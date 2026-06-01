'use server';
import { getEOBIEmployees, EOBIEmployee } from './eobi-employee';
import { getEOBIWithdrawals, EOBIWithdrawal } from './eobi-withdrawal';

export interface EOBIReportItem extends EOBIEmployee {
    totalWithdrawal: number;
    closingBalance: number;
}

export async function getEOBIReportData(): Promise<{ status: boolean; data?: EOBIReportItem[]; message?: string }> {
    try {
        // Fetch runs in parallel
        const [employeesRes, withdrawalsRes] = await Promise.all([
            getEOBIEmployees(),
            getEOBIWithdrawals()
        ]);

        if (!employeesRes.status || !employeesRes.data) {
            return { status: false, message: employeesRes.message || 'Failed to fetch employees' };
        }

        const employees = employeesRes.data;
        const withdrawals = withdrawalsRes.status && withdrawalsRes.data ? withdrawalsRes.data : [];

        // Aggregate withdrawals by employee
        const withdrawalMap = new Map<string, number>();
        withdrawals.forEach((w) => {
            // Include both pending and approved withdrawals for the report
            // Exclude only rejected or cancelled ones
            if (w.approvalStatus !== 'rejected' && w.status !== 'cancelled') {
                const current = withdrawalMap.get(w.employeeId) || 0;
                withdrawalMap.set(w.employeeId, current + Number(w.withdrawalAmount));
            }
        });

        // Combine data
        const reportData: EOBIReportItem[] = employees.map((emp) => {
            const totalWithdrawal = withdrawalMap.get(emp.id) || 0;
            // totalEOBIBalance from API is "Total Contributions" (Gross)
            // So Closing = Gross - Withdrawal
            const closingBalance = emp.totalEOBIBalance - totalWithdrawal;

            return {
                ...emp,
                totalWithdrawal,
                closingBalance
            };
        });

        return { status: true, data: reportData };
    } catch (error) {
        console.error('Error fetching EOBI report data:', error);
        return {
            status: false,
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}
