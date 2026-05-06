import { getDepartments, getSubDepartments } from "@/lib/actions/department";
import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { PayslipsContent } from "./payslips-content";

export default async function PayslipsPage() {
    const [deptRes, subDeptRes, empRes] = await Promise.all([
        getDepartments(),
        getSubDepartments(),
        getEmployeesForDropdown(),
    ]);

    const departments = deptRes.status ? deptRes.data : [];
    const subDepartments = subDeptRes.status ? subDeptRes.data : [];
    const employees = empRes.status ? (empRes.data || []) : [];

    return (
        <div className="p-0">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Employee Payslips</h1>
                <p className="text-sm text-muted-foreground">
                    View and download detailed employee payslips for confirmed months.
                </p>
            </div>
            <PayslipsContent
                departments={departments}
                subDepartments={subDepartments}
                employees={employees}
            />
        </div>
    );
}
