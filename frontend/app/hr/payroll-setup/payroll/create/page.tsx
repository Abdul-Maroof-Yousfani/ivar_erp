
import { Suspense } from "react";
import { GeneratePayrollClient } from "./client";
import { getDepartments } from "@/lib/actions/department";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
    title: "Generate Payroll | HRM",
    description: "Generate monthly payroll for employees",
};

export default async function GeneratePayrollPage() {
    const [departmentsResult, user] = await Promise.all([
        getDepartments(),
        getCurrentUser(),
    ]);

    const departments = departmentsResult.status ? departmentsResult.data : [];
    const userId = user?.id?.toString() || "";

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <GeneratePayrollClient
                initialDepartments={departments}
                currentUserId={userId}
            />
        </Suspense>
    );
}
