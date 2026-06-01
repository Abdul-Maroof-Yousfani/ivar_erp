import { EOBIEmployeeList } from "./eobi-employee-list";
import { ListError } from "@/components/dashboard/list-error";
import { getEOBIEmployees } from "@/lib/actions/eobi-employee";

export const dynamic = "force-dynamic";

export default async function ViewEOBIEmployeePage() {
    try {
        const result = await getEOBIEmployees();
        const initialData = result.status && result.data ? result.data : [];

        return <EOBIEmployeeList initialData={initialData} />;
    } catch (error) {
        console.error("Error in ViewEOBIEmployeePage:", error);
        return (
            <ListError
                title="Failed to load EOBI employee data"
                message={
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred. Please try again."
                }
            />
        );
    }
}
