import { AllowancePayslipList } from "./allowance-payslip-list";
import { ListError } from "@/components/dashboard/list-error";
import { getAllowances } from "@/lib/actions/allowance";

export const dynamic = "force-dynamic";

export default async function AllowancePayslipPage() {
  try {
    const allowanceResult = await getAllowances();
    const allowances = allowanceResult.status && allowanceResult.data ? allowanceResult.data : [];

    return <AllowancePayslipList initialAllowances={allowances} />;
  } catch (error) {
    console.error("Error in AllowancePayslipPage:", error);
    return (
      <ListError
        title="Failed to load allowance payslip"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

