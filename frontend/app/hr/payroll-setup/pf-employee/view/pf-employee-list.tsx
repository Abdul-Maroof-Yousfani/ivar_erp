"use client";

import { useState } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import { PFEmployee } from "@/lib/actions/pf-employee";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign } from "lucide-react";

interface PFEmployeeListProps {
    initialData: PFEmployee[];
}

export function PFEmployeeList({ initialData }: PFEmployeeListProps) {
    const [data] = useState<PFEmployee[]>(initialData);

    // Calculate summary statistics
    const totalEmployees = data.length;
    const totalPFBalance = data.reduce((sum, emp) => sum + emp.totalPFBalance, 0);
    const totalEmployeeContribution = data.reduce((sum, emp) => sum + emp.employeeContribution, 0);
    const totalEmployerContribution = data.reduce((sum, emp) => sum + emp.employerContribution, 0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalEmployees}</div>
                        <p className="text-xs text-muted-foreground">
                            With active PF accounts
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total PF Balance</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(totalPFBalance)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Employee + Employer contributions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Employee Contribution</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(totalEmployeeContribution)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total employee deductions
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Employer Contribution</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(totalEmployerContribution)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total employer contributions
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Provident Fund Employee Balances</CardTitle>
                    <CardDescription>
                        View total PF balances for all employees with provident fund enabled
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable<PFEmployee>
                        columns={columns}
                        data={data}
                        searchFields={[
                            { key: "employeeDetails", label: "Employee" },
                        ]}
                        tableId="pf-employee-list"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
