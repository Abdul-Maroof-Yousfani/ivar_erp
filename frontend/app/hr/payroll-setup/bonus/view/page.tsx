import { BonusList } from "./bonus-list";
import { ListError } from "@/components/hr/list-error";
import { getBonuses } from "@/lib/actions/bonus";

export const dynamic = "force-dynamic";

export default async function ViewBonusPage() {
  try {
    const result = await getBonuses();
    const initialData = result.status && result.data ? result.data : [];

    return <BonusList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewBonusPage:", error);
    return (
      <ListError
        title="Failed to load bonuses"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

