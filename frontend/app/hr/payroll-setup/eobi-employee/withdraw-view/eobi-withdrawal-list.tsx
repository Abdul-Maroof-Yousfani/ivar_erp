"use client";

import { useState } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import { EOBIWithdrawal } from "@/lib/actions/eobi-withdrawal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EOBIWithdrawalListProps {
    initialData: EOBIWithdrawal[];
}

export function EOBIWithdrawalList({ initialData }: EOBIWithdrawalListProps) {
    const [data] = useState<EOBIWithdrawal[]>(initialData);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    EOBI Withdrawal List
                </h2>
                <p className="text-muted-foreground">
                    View and manage EOBI withdrawal requests
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All EOBI Withdrawals</CardTitle>
                    <CardDescription>
                        Complete list of EOBI withdrawal requests
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable<EOBIWithdrawal>
                        columns={columns}
                        data={data}
                        searchFields={[
                            { key: "employeeDetails", label: "Employee" },
                        ]}
                        tableId="eobi-withdrawal-list"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
