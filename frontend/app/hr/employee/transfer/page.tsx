import { Suspense } from "react";
import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { getLocations } from "@/lib/actions/location";
import { TransferForm } from "@/components/employee/transfer-form";
import { Separator } from "@/components/ui/separator";

export default async function EmployeeTransferPage() {
    const [employeesRes, locationsRes] = await Promise.all([
        getEmployeesForDropdown(),
        getLocations(),
    ]);

    const employees = employeesRes.status && employeesRes.data ? employeesRes.data : [];
    const locations = locationsRes.status && locationsRes.data ? locationsRes.data : [];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Employee Transfer</h3>
                <p className="text-sm text-muted-foreground">
                    Transfer an employee to a different location, city, or province.
                </p>
            </div>
            <Separator />

            <Suspense fallback={<div>Loading form...</div>}>
                <TransferForm employees={employees} locations={locations} states={[]} />
            </Suspense>
        </div>
    );
}
