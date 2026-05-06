import { Metadata } from "next";
import { ReportContent } from "./report-content";
import { getDepartments } from "@/lib/actions/department";
import { getEmployeesForDropdown } from "@/lib/actions/employee";

export const metadata: Metadata = {
    title: "Payroll Report | HRM",
    description: "View and export detailed payroll reports.",
};

export default async function PayrollReportPage() {
    const [departmentsResponse, employeesResponse] = await Promise.all([
        getDepartments(),
        getEmployeesForDropdown(),
    ]);

    const departments = departmentsResponse.status ? departmentsResponse.data || [] : [];
    const employees = employeesResponse.status ? employeesResponse.data || [] : [];

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <ReportContent
                initialDepartments={departments}
                initialEmployees={employees}
            />
        </div>
    );
}
