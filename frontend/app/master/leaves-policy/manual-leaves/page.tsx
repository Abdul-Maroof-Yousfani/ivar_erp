"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

const departments = ["HR", "IT", "Finance", "Marketing", "Operations"];
const subDepartments: Record<string, string[]> = {
  HR: ["Recruitment", "Payroll", "Training"],
  IT: ["Development", "Support", "Infrastructure"],
  Finance: ["Accounts", "Audit", "Tax"],
  Marketing: ["Digital", "Brand", "PR"],
  Operations: ["Logistics", "Quality", "Production"],
};
const employees = [
  { id: 1, name: "John Doe", department: "HR" },
  { id: 2, name: "Jane Smith", department: "IT" },
  { id: 3, name: "Mike Johnson", department: "Finance" },
  { id: 4, name: "Sarah Williams", department: "Marketing" },
];

export default function ManualLeavesPage() {
  const [formData, setFormData] = useState({
    department: "",
    subDepartment: "",
    employee: "",
  });

  const handleSearch = () => {
    if (!formData.employee) {
      toast.error("Please select an employee");
      return;
    }
    toast.success("Search completed");
  };

  const availableSubDepts = formData.department
    ? subDepartments[formData.department] || []
    : [];

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link href="/master/leaves-policy/add">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Add Policy
          </Button>
        </Link>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-semibold">
            Create Manual Leaves
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="space-y-2 ">
              <Label className="text-muted-foreground">Departments:</Label>
              <Select
                value={formData.department}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    department: value,
                    subDepartment: "",
                  })
                }
              >
                <SelectTrigger className="bg-background w-full">
                  <SelectValue placeholder="Select Option" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Sub Department</Label>
              <Select
                value={formData.subDepartment}
                onValueChange={(value) =>
                  setFormData({ ...formData, subDepartment: value })
                }
                disabled={!formData.department}
              >
                <SelectTrigger className="bg-background w-full">
                  <SelectValue
                    placeholder={
                      formData.department
                        ? "Select Sub Department"
                        : "No Record Found"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSubDepts.map((subDept) => (
                    <SelectItem key={subDept} value={subDept}>
                      {subDept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Employee: <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.employee}
                onValueChange={(value) =>
                  setFormData({ ...formData, employee: value })
                }
              >
                <SelectTrigger className="bg-background w-full">
                  <SelectValue placeholder="None selected" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button onClick={handleSearch} className="bg-primary">
              Search
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
