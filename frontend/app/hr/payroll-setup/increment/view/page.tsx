import { IncrementList } from "./increment-list";
import { ListError } from "@/components/dashboard/list-error";
import type { IncrementRow } from "./columns";
import { getIncrements } from "@/lib/actions/increment";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function ViewIncrementPage() {
  try {
    const result = await getIncrements();
    
    let initialData: IncrementRow[] = [];
    
    if (result.status && result.data) {
      initialData = result.data.map((item, index) => {
        // Format increment and decrement values separately
        const incrementValue = item.incrementMethod === "Amount"
          ? item.incrementAmount || 0
          : item.incrementPercentage || 0;
        
        // Increment display (only show if type is Increment)
        const incrementDisplay = item.incrementType === "Increment"
          ? item.incrementMethod === "Amount"
            ? `${Number(incrementValue).toLocaleString()}`
            : `${Number(incrementValue).toFixed(2)}%`
          : "";
        
        // Decrement display (only show if type is Decrement)
        const decrementDisplay = item.incrementType === "Decrement"
          ? item.incrementMethod === "Amount"
            ? `${Number(incrementValue).toLocaleString()}`
            : `${Number(incrementValue).toFixed(2)}%`
          : "";
        
        // Format date
        let formattedDate = "N/A";
        try {
          if (item.promotionDate) {
            formattedDate = format(new Date(item.promotionDate), "dd-MMM-yyyy");
          }
        } catch {
          formattedDate = item.promotionDate || "N/A";
        }
        
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
          designation: item.designationName || "N/A",
          increment: incrementDisplay,
          decrement: decrementDisplay,
          salary: Number(item.salary).toLocaleString(),
          date: formattedDate,
          status: item.status || "Active",
        };
      });
    }

    return <IncrementList initialData={initialData} />;
  } catch (error) {
    console.error("Error in ViewIncrementPage:", error);
    return (
      <ListError
        title="Failed to load increments"
        message={
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Please try again."
        }
      />
    );
  }
}

