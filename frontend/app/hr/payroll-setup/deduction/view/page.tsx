import { DeductionList } from "./deduction-list";
import { ListError } from "@/components/dashboard/list-error";
import { getDeductions } from "@/lib/actions/deduction";

export const dynamic = "force-dynamic";

export default async function ViewDeductionPage() {
  try {
    const result = await getDeductions();
    const initialData = result.status && result.data ? result.data : [];

    return <DeductionList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewDeductionPage:", error);
    return (
      <ListError
        title="Failed to load deductions"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

