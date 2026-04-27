"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createDepartments } from "@/lib/actions/department";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getAllocations, type Allocation } from "@/lib/actions/allocation";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function AddDepartmentPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [departments, setDepartments] = useState([{ id: 1, name: "", headId: "", allocationId: "" }]);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  useEffect(() => {
    getEmployeesForDropdown().then((result) => {
      if (result.status && result.data) {
        setEmployees(result.data);
      }
    });

    getAllocations().then((result) => {
      if (result.status && result.data) {
        setAllocations(result.data);
      }
    });
  }, []);

  const addRow = () => {
    setDepartments([...departments, { id: Date.now(), name: "", headId: "", allocationId: "" }]);
  };

  const removeRow = (id: number) => {
    if (departments.length > 1) {
      setDepartments(departments.filter((d) => d.id !== id));
    }
  };

  const updateName = (id: number, name: string) => {
    setDepartments(departments.map((d) => (d.id === id ? { ...d, name } : d)));
  };

  const updateHeadId = (id: number, headId: string) => {
    setDepartments(departments.map((d) => (d.id === id ? { ...d, headId } : d)));
  };

  const updateAllocationId = (id: number, allocationId: string) => {
    setDepartments(departments.map((d) => (d.id === id ? { ...d, allocationId } : d)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDepartments = departments.filter((d) => d.name.trim());

    if (validDepartments.length === 0) {
      toast.error("Please enter at least one department name");
      return;
    }

    startTransition(async () => {
      const items = validDepartments.map((d) => ({
        name: d.name.trim(),
        headId: d.headId || undefined,
        allocationId: d.allocationId || undefined,
      }));

      const result = await createDepartments(items);
      if (result.status) {
        toast.success(result.message || "Departments created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/department/list");
        });
      } else {
        toast.error(result.message || "Failed to create departments");
      }
    });
  };

  return (
    <PermissionGuard permissions="master.department.create">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/master/department/list" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add Departments</CardTitle>
            <CardDescription>Create one or more departments for your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <Label>Departments</Label>
                {departments.map((dept, index) => (
                  <div key={dept.id} className="space-y-2 p-4 border rounded-md">
                    <div className="flex gap-2 items-start">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Name</Label>
                          <Input
                            placeholder={`Department Name`}
                            value={dept.name}
                            onChange={(e) => updateName(dept.id, e.target.value)}
                            disabled={isPending}
                          />
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
                            value={dept.headId}
                            onValueChange={(value) => updateHeadId(dept.id, value || "")}
                            placeholder="Select head"
                            searchPlaceholder="Search employee..."
                            emptyMessage="No employees found"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Allocation (Optional)</Label>
                          <Autocomplete
                            options={[
                              { value: "", label: "No Allocation" },
                              ...allocations.map((alloc) => ({
                                value: alloc.id,
                                label: alloc.name,
                              })),
                            ]}
                            value={dept.allocationId}
                            onValueChange={(value) => updateAllocationId(dept.id, value || "")}
                            placeholder="Select allocation"
                            searchPlaceholder="Search allocation..."
                            emptyMessage="No allocations found"
                          />
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(dept.id)}
                        disabled={departments.length === 1 || isPending}
                        className="mt-6"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-between">
                <div className="flex gap-2">
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create {departments.length > 1 ? `${departments.length} Departments` : "Department"}
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
    </PermissionGuard>
  );
}
