import { LoanRequestUnified } from "./loan-request-unified";
import { ListError } from "@/components/dashboard/list-error";
import { getLoanRequests } from "@/lib/actions/loan-request";
import type { LoanRequestRow } from "./columns";
import type { LoanReportRow } from "../report/columns";

export const dynamic = "force-dynamic";

const formatMonthYear = (monthYear?: string) => {
  if (!monthYear) return "—";
  const [year, month] = monthYear.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} / ${year}`;
};

// Calculate payment progress based on status and time
const calculatePaymentProgress = (
  loanAmount: number,
  numberOfInstallments: number | null | undefined,
  repaymentStartMonthYear: string | null | undefined,
  status: string
): {
  paidAmount: number;
  remainingAmount: number;
  paidInstallments: number;
  totalInstallments: number;
  progressPercentage: number;
} => {
  // If completed, fully paid
  if (status === "completed" || status === "Completed") {
    return {
      paidAmount: loanAmount,
      remainingAmount: 0,
      paidInstallments: numberOfInstallments || 1,
      totalInstallments: numberOfInstallments || 1,
      progressPercentage: 100,
    };
  }

  // If rejected or cancelled, nothing paid
  if (status === "rejected" || status === "Rejected" || status === "cancelled" || status === "Cancelled") {
    return {
      paidAmount: 0,
      remainingAmount: loanAmount,
      paidInstallments: 0,
      totalInstallments: numberOfInstallments || 1,
      progressPercentage: 0,
    };
  }

  // If not approved or not disbursed, nothing paid yet
  if (status === "pending" || status === "Pending" || status === "approved" || status === "Approved") {
    return {
      paidAmount: 0,
      remainingAmount: loanAmount,
      paidInstallments: 0,
      totalInstallments: numberOfInstallments || 1,
      progressPercentage: 0,
    };
  }

  // If disbursed, calculate based on time elapsed
  if (status === "disbursed" || status === "Disbursed") {
    if (!repaymentStartMonthYear || !numberOfInstallments) {
      return {
        paidAmount: 0,
        remainingAmount: loanAmount,
        paidInstallments: 0,
        totalInstallments: numberOfInstallments || 1,
        progressPercentage: 0,
      };
    }

    const [startYear, startMonth] = repaymentStartMonthYear.split("-").map(Number);
    const startDate = new Date(startYear, startMonth - 1, 1);
    const now = new Date();

    // Calculate months elapsed
    const monthsElapsed = Math.max(0,
      (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth())
    );

    const totalInstallments = numberOfInstallments;
    const paidInstallments = Math.min(monthsElapsed, totalInstallments);
    const installmentAmount = loanAmount / totalInstallments;
    const paidAmount = paidInstallments * installmentAmount;
    const remainingAmount = loanAmount - paidAmount;
    const progressPercentage = totalInstallments > 0
      ? Math.round((paidInstallments / totalInstallments) * 100)
      : 0;

    return {
      paidAmount: Math.round(paidAmount * 100) / 100,
      remainingAmount: Math.round(remainingAmount * 100) / 100,
      paidInstallments,
      totalInstallments,
      progressPercentage,
    };
  }

  // Default: nothing paid
  return {
    paidAmount: 0,
    remainingAmount: loanAmount,
    paidInstallments: 0,
    totalInstallments: numberOfInstallments || 1,
    progressPercentage: 0,
  };
};

export default async function ViewLoanRequestPage() {
  try {
    const result = await getLoanRequests();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load loan requests"
          message={result.message || "An unexpected error occurred. Please try again."}
        />
      );
    }

    // Transform API data to LoanRequestRow format (for List View)
    const listData: LoanRequestRow[] = result.data.map((loanRequest, index) => {
      const loanAmount = typeof loanRequest.amount === 'string' ? parseFloat(loanRequest.amount) : loanRequest.amount;

      const paymentProgress = calculatePaymentProgress(
        loanAmount,
        loanRequest.numberOfInstallments,
        loanRequest.repaymentStartMonthYear || null,
        loanRequest.status
      );

      return {
        id: loanRequest.id,
        sNo: index + 1,
        empId: loanRequest.employee?.employeeId || loanRequest.employeeId || "—",
        empName: loanRequest.employee?.employeeName || "—",
        department: loanRequest.employee?.department?.name || "—",
        loanType: loanRequest.loanType?.name || "—",
        amount: loanAmount,
        requestedDate: loanRequest.requestedDate ? new Date(loanRequest.requestedDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : "—",
        repaymentStartMonthYear: formatMonthYear(loanRequest.repaymentStartMonthYear),
        numberOfInstallments: loanRequest.numberOfInstallments || "—",
        approvalStatus: loanRequest.approvalStatus === 'approved' ? 'Approved' :
          loanRequest.approvalStatus === 'rejected' ? 'Rejected' : 'Pending',
        status: loanRequest.status === 'approved' ? 'Approved' :
          loanRequest.status === 'disbursed' ? 'Disbursed' :
            loanRequest.status === 'completed' ? 'Completed' :
              loanRequest.status === 'cancelled' ? 'Cancelled' :
                loanRequest.status === 'rejected' ? 'Rejected' : 'Pending',
        paidAmount: paymentProgress.paidAmount,
        remainingAmount: paymentProgress.remainingAmount,
        createdById: loanRequest.createdById,
      };
    });

    // Transform API data to LoanReportRow format (for Report View)
    const reportData: LoanReportRow[] = result.data.map((loanRequest: any, index: number) => {
      const loanAmount = typeof loanRequest.amount === 'string'
        ? parseFloat(loanRequest.amount)
        : loanRequest.amount;

      const paidAmount = loanRequest.paidAmount || 0;
      const remainingAmount = Math.max(0, loanAmount - paidAmount);

      // Estimate paid installments (since we don't track installments in payroll yet)
      const totalInstallments = loanRequest.numberOfInstallments || 1;
      const installmentAmount = loanAmount / totalInstallments;
      const paidInstallments = installmentAmount > 0
        ? Math.round(paidAmount / installmentAmount)
        : 0;

      const progressPercentage = loanAmount > 0
        ? Math.round((paidAmount / loanAmount) * 100)
        : 0;

      return {
        id: loanRequest.id,
        sNo: index + 1,
        empId: loanRequest.employee?.employeeId || loanRequest.employeeId || "—",
        empName: loanRequest.employee?.employeeName || "—",
        department: loanRequest.employee?.department?.name || "—",
        subDepartment: loanRequest.employee?.subDepartment?.name || "—",
        loanType: loanRequest.loanType?.name || "—",
        loanAmount,
        requestedDate: loanRequest.requestedDate ? new Date(loanRequest.requestedDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }) : "—",
        repaymentStartMonthYear: formatMonthYear(loanRequest.repaymentStartMonthYear),
        numberOfInstallments: loanRequest.numberOfInstallments || 0,
        installmentAmount: Math.round(installmentAmount * 100) / 100,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        paidInstallments: paidInstallments,
        totalInstallments: totalInstallments,
        progressPercentage: progressPercentage,
        status: loanRequest.status === 'approved' ? 'Approved' :
          loanRequest.status === 'disbursed' ? 'Disbursed' :
            loanRequest.status === 'completed' ? 'Completed' :
              loanRequest.status === 'cancelled' ? 'Cancelled' :
                loanRequest.status === 'rejected' ? 'Rejected' : 'Pending',
        approvalStatus: loanRequest.approvalStatus === 'approved' ? 'Approved' :
          loanRequest.approvalStatus === 'rejected' ? 'Rejected' : 'Pending',
      };
    });

    return <LoanRequestUnified listData={listData} reportData={reportData} />;
  } catch (error) {
    console.error("Error in ViewLoanRequestPage:", error);
    return (
      <ListError
        title="Failed to load loan requests"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}
