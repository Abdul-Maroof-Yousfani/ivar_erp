import { SocialSecurityEmployeeList } from "./social-security-employee-list";
import { ListError } from "@/components/dashboard/list-error";
import { getSocialSecurityEmployees } from "@/lib/actions/social-security-employee";

export const dynamic = "force-dynamic";

export default async function ViewSocialSecurityEmployeePage() {
    try {
        const result = await getSocialSecurityEmployees();
        const initialData = result.status && result.data ? result.data : [];

        return <SocialSecurityEmployeeList initialData={initialData} />;
    } catch (error) {
        console.error("Error in ViewSocialSecurityEmployeePage:", error);
        return (
            <ListError
                title="Failed to load Social Security employee data"
                message={
                    error instanceof Error
                        ? error.message
                        : "An unexpected error occurred. Please try again."
                }
            />
        );
    }
}
