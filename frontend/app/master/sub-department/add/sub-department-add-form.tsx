"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Department, createSubDepartments } from "@/lib/actions/department";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

interface SubDepartmentAddFormProps {
  departments: Department[];
  defaultDepartmentId?: string;
}

export function SubDepartmentAddForm({ departments, defaultDepartmentId }: SubDepartmentAddFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState([{ id: 1, name: "", departmentId: defaultDepartmentId || "", headId: "" }]);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);

  useEffect(() => {
    getEmployeesForDropdown().then((result) => {
      if (result.status && result.data) {
        setEmployees(result.data);
      }
    });
  }, []);

  const addRow = () => {
    setRows([...rows, { id: Date.now(), name: "", departmentId: "", headId: "" }]);
  };

  const removeRow = (id: number) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const updateRow = (id: number, field: "name" | "departmentId" | "headId", value: string) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.name.trim() && r.departmentId);

    if (validRows.length === 0) {
      toast.error("Please enter at least one sub-department with a department selected");
      return;
    }

    startTransition(async () => {
      const result = await createSubDepartments(
        validRows.map((r) => ({ name: r.name.trim(), departmentId: r.departmentId, headId: r.headId || undefined }))
      );
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/sub-department/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/sub-department/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Sub-Departments</CardTitle>
          <CardDescription>Create one or more sub-departments under departments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Label>Departments</Label>
              {rows.map((row, index) => (
                <div key={row.id} className="space-y-2">
                  <div className="flex gap-2">
                    <Select
                      value={row.departmentId}
                      onValueChange={(value) => updateRow(row.id, "departmentId", value)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-1/3">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={`Sub-department ${index + 1}`}
                      value={row.name}
                      onChange={(e) => updateRow(row.id, "name", e.target.value)}
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1 || isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Head (Optional)</Label>
                    <Autocomplete
                      options={[
                        { value: "", label: "No Head" },
                        ...employees.map((emp) => ({
                          value: emp.id,
                          label: `${emp.employeeName} (${emp.employeeId})`,
                        })),
                      ]}
                      value={row.headId}
                      onValueChange={(value) => updateRow(row.id, "headId", value || "")}
                      placeholder="Select sub-department head"
                      searchPlaceholder="Search employee..."
                      emptyMessage="No employees found"
                    />
                  </div>
                </div>
              ))}
             
            </div>
              <div className="flex gap-2 justify-between">
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {rows.length > 1 ? `${rows.length} Sub-Departments` : "Sub-Department"}
              </Button>
               <Button type="button" variant="outline" onClick={() => {
                startTransition(() => {
                  addTransitionType("nav-back");
                  router.back();
                });
              }}>
                Cancel
              </Button>
            </div>
            <button
                type="button"
                onClick={addRow}
                disabled={isPending}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                + Add more
              </button>
              </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
