import { getHolidays } from "@/lib/actions/holiday";
import { HolidayList } from "./holiday-list";
import { ListError } from "@/components/dashboard/list-error";

export const dynamic = "force-dynamic";

export default async function HolidayListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  try {
    const { newItemId } = await searchParams;
    const result = await getHolidays();

    if (!result.status || !result.data) {
      return (
        <ListError
          title="Failed to load holidays"
          message={result.message || "Unable to fetch holidays. Please check your connection and try again."}
        />
      );
    }

    return <HolidayList initialHolidays={result.data || []} newItemId={newItemId} />;
  } catch (error) {
    console.error("Error in HolidayListPage:", error);
    return (
      <ListError
        title="Failed to load holidays"
        message={error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      />
    );
  }
}

