"use client";

import { useState } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import { PFWithdrawal } from "@/lib/actions/pf-withdrawal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PFWithdrawalListProps {
    initialData: PFWithdrawal[];
}

export function PFWithdrawalList({ initialData }: PFWithdrawalListProps) {
    const [data] = useState<PFWithdrawal[]>(initialData);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    PF Withdrawal List
                </h2>
                <p className="text-muted-foreground">
                    View and manage provident fund withdrawal requests
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All PF Withdrawals</CardTitle>
                    <CardDescription>
                        Complete list of provident fund withdrawal requests
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable<PFWithdrawal>
                        columns={columns}
                        data={data}
                        searchFields={[
                            { key: "employeeDetails", label: "Employee" },
                        ]}
                        tableId="pf-withdrawal-list"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
