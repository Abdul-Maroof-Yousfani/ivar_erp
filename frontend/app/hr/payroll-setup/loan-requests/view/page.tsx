import { LoanRequestList } from "./loan-request-list";
import { ListError } from "@/components/dashboard/list-error";
import type { LoanRequestRow } from "./columns";
import { getLoanRequests } from "@/lib/actions/loan-request";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ViewLoanRequestPage() {
  try {
    const result = await getLoanRequests();
    
    let initialData: LoanRequestRow[] = [];
    
    if (result.status && result.data) {
      initialData = result.data.map((item, index) => {
        // Format month name
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = item.neededOnMonth ? monthNames[parseInt(item.neededOnMonth) - 1] || item.neededOnMonth : "N/A";
        
        // Backend returns transformed data with employeeCode, department, subDepartment
        const empId = item.employeeCode || item.employeeId || "";
        const empName = item.employeeName || "N/A";
        const department = item.department || "";
        const subDepartment = item.subDepartment || "";
        
        return {
          id: item.id,
          sNo: index + 1,
          empId: empId,
          empName: empName,
          department: department,
          subDepartment: subDepartment,
          month: month,
          year: item.neededOnYear || "N/A",
          loanAmount: Number(item.loanAmount).toLocaleString(),
          topUpAmount: item.topUpAmount ? Number(item.topUpAmount).toLocaleString() : "0",
          totalLoan: item.totalLoan ? Number(item.totalLoan).toLocaleString() : Number(item.loanAmount).toLocaleString(),
          loanAdjustment: item.loanAdjustment ? Number(item.loanAdjustment).toLocaleString() : "0",
          description: item.description || "N/A",
          overallPF: item.overallPF ? Number(item.overallPF).toLocaleString() : "0",
          paidLoanAmount: item.paidLoanAmount ? Number(item.paidLoanAmount).toLocaleString() : "0",
          remainingAmount: item.remainingAmount ? Number(item.remainingAmount).toLocaleString() : Number(item.loanAmount).toLocaleString(),
          approvalRemarks1: item.approvalRemarks1 || "-",
          status: item.status || "Active",
        };
      });
    }

    return <LoanRequestList initialData={initialData} />;
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

