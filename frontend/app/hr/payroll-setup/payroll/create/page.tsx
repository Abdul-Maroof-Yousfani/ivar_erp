
import { Suspense } from "react";
import { GeneratePayrollClient } from "./client";
import { getDepartments } from "@/lib/actions/department";
import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
    title: "Generate Payroll | HRM",
    description: "Generate monthly payroll for employees",
};

export default async function GeneratePayrollPage() {
    const [departmentsResult, employeesResult, user] = await Promise.all([
        getDepartments(),
        getEmployeesForDropdown(),
        getCurrentUser(),
    ]);

    const departments = departmentsResult.status ? departmentsResult.data : [];
    const employees = employeesResult.status ? employeesResult.data ?? [] : [];
    const userId = user?.id?.toString() || "";

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <GeneratePayrollClient
                initialDepartments={departments}
                initialEmployees={employees}
                currentUserId={userId}
            />
        </Suspense>
    );
}
