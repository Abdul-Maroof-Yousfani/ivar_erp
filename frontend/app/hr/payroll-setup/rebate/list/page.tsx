import { RebateList } from "./rebate-list";
import { ListError } from "@/components/dashboard/list-error";
import { getRebates } from "@/lib/actions/rebate";

export const dynamic = "force-dynamic";

export default async function RebateListPage() {
  try {
    const result = await getRebates();
    const initialData = result.status && result.data ? result.data : [];

    return <RebateList initialData={initialData} />;
  } catch (error) {
    console.error("Error in RebateListPage:", error);
    return (
      <ListError
        title="Failed to load rebate records"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

