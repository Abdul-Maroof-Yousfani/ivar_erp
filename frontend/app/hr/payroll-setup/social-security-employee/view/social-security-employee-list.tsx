"use client";

import { useState } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import { SocialSecurityEmployee } from "@/lib/actions/social-security-employee";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, DollarSign } from "lucide-react";

interface SocialSecurityEmployeeListProps {
  initialData: SocialSecurityEmployee[];
}

export function SocialSecurityEmployeeList({ initialData }: SocialSecurityEmployeeListProps) {
  const [data] = useState<SocialSecurityEmployee[]>(initialData);

  // Calculate summary statistics
  const totalEmployees = data.length;
  const totalMonthlyContribution = data.reduce((sum, emp) => sum + Number(emp.monthlyContribution), 0);
  const activeRegistrations = data.filter(emp => emp.status === 'active').length;

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Employees with SS registration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Contribution</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalMonthlyContribution)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total monthly liability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Status</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeRegistrations}
            </div>
            <p className="text-xs text-muted-foreground">
              Active registrations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Social Security Employee Registrations</CardTitle>
          <CardDescription>
            View all employees registered with social security institutions (SESSI, PESSI, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<SocialSecurityEmployee>
            columns={columns}
            data={data}
            searchFields={[
              { key: "employeeDetails", label: "Employee" },
              { key: "institution.name", label: "Institution" }
            ]}
            tableId="ss-employee-list"
          />
        </CardContent>
      </Card>
    </div>
  );
}
