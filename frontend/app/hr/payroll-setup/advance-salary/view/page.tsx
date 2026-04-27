import { AdvanceSalaryList } from "./advance-salary-list";
import { ListError } from "@/components/dashboard/list-error";
import { getAdvanceSalaries } from "@/lib/actions/advance-salary";
import type { AdvanceSalaryRow } from "./columns";

export const dynamic = "force-dynamic";

const formatMonthYear = (monthYear: string) => {
  if (!monthYear) return "—";
  const [year, month] = monthYear.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} / ${year}`;
};

export default async function ViewAdvanceSalaryPage() {
  try {
    const result = await getAdvanceSalaries();
    
    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load advance salaries"
          message={result.message || "An unexpected error occurred. Please try again."}
        />
      );
    }

    // Transform API data to AdvanceSalaryRow format
    const initialData: AdvanceSalaryRow[] = result.data.map((advanceSalary, index) => ({
      id: advanceSalary.id,
      sNo: index + 1,
      empId: advanceSalary.employee?.employeeId || advanceSalary.employeeId || "—",
      empName: advanceSalary.employee?.employeeName || "—",
      amountNeeded: typeof advanceSalary.amount === 'string' ? parseFloat(advanceSalary.amount) : advanceSalary.amount,
      salaryNeedOn: advanceSalary.neededOn ? new Date(advanceSalary.neededOn).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : "—",
      deductionMonthYear: formatMonthYear(advanceSalary.deductionMonthYear),
      approval1: advanceSalary.approvalStatus === 'approved' ? 'Approved' : 
                 advanceSalary.approvalStatus === 'rejected' ? 'Rejected' : 'Pending',
      status: advanceSalary.status === 'active' ? 'Active' :
              advanceSalary.status === 'completed' ? 'Completed' :
              advanceSalary.status === 'cancelled' ? 'Cancelled' :
              advanceSalary.status === 'rejected' ? 'Rejected' : 'Pending',
      createdById: advanceSalary.createdById,
    }));

    return <AdvanceSalaryList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewAdvanceSalaryPage:", error);
    return (
      <ListError
        title="Failed to load advance salaries"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

