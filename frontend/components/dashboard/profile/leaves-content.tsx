"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "@/lib/api";
import { CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getEmployeeLeaveBalance, EmployeeLeaveInfo } from "@/lib/actions/leave-application";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface LeavesContentProps {
    employee: Employee | null;
}

export function LeavesContent({ employee }: LeavesContentProps) {
    const [leaveInfo, setLeaveInfo] = useState<EmployeeLeaveInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBalance() {
            if (!employee?.id) return;
            try {
                const res = await getEmployeeLeaveBalance(employee.id);
                if (res.status && res.data) {
                    setLeaveInfo(res.data);
                }
            } catch (error) {
                console.error("Failed to fetch leave balance", error);
            } finally {
                setLoading(false);
            }
        }
        fetchBalance();
    }, [employee?.id]);

    if (!employee) {
        return <div className="text-muted-foreground">Loading leaves information...</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5" />
                        Leaves Overview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : leaveInfo ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                    <div className="text-sm font-medium text-muted-foreground">Total Leaves</div>
                                    <div className="text-2xl font-bold">{leaveInfo.leaveBalances.reduce((acc, curr) => acc + curr.totalLeaves, 0)}</div>
                                </div>
                                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                    <div className="text-sm font-medium text-muted-foreground">Used</div>
                                    <div className="text-2xl font-bold text-orange-600">{leaveInfo.totalTaken}</div>
                                </div>
                                <div className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                                    <div className="text-sm font-medium text-muted-foreground">Remaining</div>
                                    <div className="text-2xl font-bold text-green-600">{leaveInfo.totalRemaining}</div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Leave Balance Breakdown</h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {leaveInfo.leaveBalances.map((balance) => (
                                        <div key={balance.leaveTypeId} className="p-4 border rounded-lg space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{balance.leaveTypeName}</span>
                                                <Badge variant={balance.remainingLeaves > 0 ? "outline" : "destructive"}>
                                                    {balance.remainingLeaves} remaining
                                                </Badge>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>Used: {balance.usedLeaves}</span>
                                                    <span>Total: {balance.totalLeaves}</span>
                                                </div>
                                                <Progress value={(balance.usedLeaves / balance.totalLeaves) * 100} className="h-2" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                           
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-muted-foreground">
                                No leave policy assigned or unable to fetch leave balance.
                            </p>
                            <Link href="/hr/leaves">
                                <Button variant="outline">Go to Leaves Management</Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
