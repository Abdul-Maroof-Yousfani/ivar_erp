import { PFEmployeeList } from "./pf-employee-list";
import { ListError } from "@/components/dashboard/list-error";
import { getPFEmployees } from "@/lib/actions/pf-employee";

export const dynamic = "force-dynamic";

export default async function ViewPFEmployeePage() {
    try {
        const result = await getPFEmployees();
        const initialData = result.status && result.data ? result.data : [];

        return <PFEmployeeList initialData={initialData} />;
    } catch (error) {
        console.error("Error in ViewPFEmployeePage:", error);
        return (
            <ListError
                title="Failed to load PF employee data"
                message={
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred. Please try again."
                }
            />
        );
    }
}
