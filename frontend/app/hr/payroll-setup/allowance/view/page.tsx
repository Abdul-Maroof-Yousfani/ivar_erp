import { AllowanceList } from "./allowance-list";
import { ListError } from "@/components/dashboard/list-error";
import { getAllowances } from "@/lib/actions/allowance";

export const dynamic = "force-dynamic";

export default async function ViewAllowancePage() {
  try {
    const result = await getAllowances();
    const initialData = result.status && result.data ? result.data : [];

    return <AllowanceList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewAllowancePage:", error);
    return (
      <ListError
        title="Failed to load allowances"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

