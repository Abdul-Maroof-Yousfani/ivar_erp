import { OvertimeList } from "./overtime-list";
import { ListError } from "@/components/dashboard/list-error";
import type { OvertimeRow } from "./columns";
import { getOvertimeRequests } from "@/lib/actions/overtime";

export const dynamic = "force-dynamic";

export default async function ViewOvertimePage() {
  try {
    const result = await getOvertimeRequests();
    
    let initialData: OvertimeRow[] = [];
    
    if (result.status && result.data) {
      initialData = result.data.map((item, index) => ({
        id: item.id,
        sNo: index + 1,
        employeeName: item.employeeName || "",
        overtimeType: item.overtimeType === "weekday" ? "Weekday" : "Holiday",
        weekdayOvertimeHours: item.weekdayOvertimeHours,
        holidayOvertimeHours: item.holidayOvertimeHours,
        date: item.date,
        approval1: item.approval1 || "Pending",
      }));
    }

    return <OvertimeList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewOvertimePage:", error);
    return (
      <ListError
        title="Failed to load overtime requests"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

