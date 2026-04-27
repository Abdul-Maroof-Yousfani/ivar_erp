"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "@/lib/api";
import { Clock, Calendar } from "lucide-react";

interface PoliciesContentProps {
    employee: Employee | null;
}

export function PoliciesContent({ employee }: PoliciesContentProps) {
    if (!employee) {
        return <div className="text-muted-foreground">Loading policies information...</div>;
    }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">
            Working Hours Policy
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {employee.workingHoursPolicyRelation?.name || "N/A"}
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Assigned Schedule
          </p>
          
          {employee.workingHoursPolicyRelation && (
            <div className="space-y-2 text-sm border-t pt-4">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Timing:</span>
                    <span className="font-medium">
                        {employee.workingHoursPolicyRelation.startWorkingHours} - {employee.workingHoursPolicyRelation.endWorkingHours}
                    </span>
                </div>
                {employee.workingHoursPolicyRelation.startBreakTime && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Break:</span>
                        <span className="font-medium">
                            {employee.workingHoursPolicyRelation.startBreakTime} - {employee.workingHoursPolicyRelation.endBreakTime}
                        </span>
                    </div>
                )}
                {employee.workingHoursPolicyRelation.lateStartTime && (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Late After:</span>
                        <span className="font-medium text-destructive">
                            {employee.workingHoursPolicyRelation.lateStartTime}
                        </span>
                    </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">
            Leaves Policy
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {employee.leavesPolicyRelation?.name || "N/A"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Assigned Leave Rules
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
