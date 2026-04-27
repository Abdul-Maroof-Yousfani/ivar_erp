"use client";

import { useState, useEffect, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import TextEditor, { initialValue } from "@/components/ui/text-editor";
import type { SerializedEditorState } from "lexical";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Printer, Download } from "lucide-react";
import Link from "next/link";
import {
  getEmployeesForDropdown,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";
import {
  getSubDepartmentsByDepartment,
  type Department,
  type SubDepartment,
} from "@/lib/actions/department";
import { createHrLetter, type HrLetterType } from "@/lib/actions/hr-letter";

interface CreateHrLetterClientProps {
  initialDepartments: Department[];
  initialEmployees: EmployeeDropdownOption[];
  initialLetterTypes: HrLetterType[];
}

export function CreateHrLetterClient({
  initialDepartments,
  initialEmployees,
  initialLetterTypes,
}: CreateHrLetterClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [departments] = useState<Department[]>(initialDepartments);
  const [employees] = useState<EmployeeDropdownOption[]>(initialEmployees);
  const [letterTypes] = useState<HrLetterType[]>(initialLetterTypes);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [formData, setFormData] = useState({
    department: "",
    subDepartment: "",
    employeeId: "",
    letterTypeId: "",
    note: "",
  });

  const [editorState, setEditorState] = useState<SerializedEditorState>(initialValue);

  // Fetch sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (formData.department) {
        setLoadingSubDepartments(true);
        try {
          const result = await getSubDepartmentsByDepartment(formData.department);
          if (result.status && result.data) {
            setSubDepartments(result.data);
          } else {
            setSubDepartments([]);
          }
        } catch (error) {
          console.error("Failed to fetch sub-departments:", error);
          setSubDepartments([]);
        } finally {
          setLoadingSubDepartments(false);
        }
      } else {
        setSubDepartments([]);
        setFormData((prev) => ({ ...prev, subDepartment: "" }));
      }
    };

    fetchSubDepartments();
  }, [formData.department]);

  // Filter employees based on department and sub-department
  const filteredEmployees = employees.filter((emp) => {
    if (formData.department) {
      if (emp.departmentId !== formData.department) return false;
    }
    if (formData.subDepartment) {
      if (emp.subDepartmentId !== formData.subDepartment) return false;
    }
    return true;
  });

  const handleDepartmentChange = (departmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      department: departmentId,
      subDepartment: "",
      employeeId: "",
    }));
  };

  const handleSubDepartmentChange = (subDepartmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      subDepartment: subDepartmentId,
      employeeId: "",
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    toast.info("Export CSV functionality will be implemented");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.department || !formData.employeeId || !formData.letterTypeId) {
      toast.error("Please fill all required fields");
      return;
    }

    // Convert editor state to JSON string
    const letterHeadContent = JSON.stringify(editorState);

    startTransition(async () => {
      try {
        const result = await createHrLetter({
          employeeId: formData.employeeId,
          letterTypeId: formData.letterTypeId,
          letterHeadContent: letterHeadContent,
          note: formData.note || undefined,
        });

        if (result.status) {
          toast.success(result.message || "HR Letter created successfully");
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/payroll-setup/hr-letters/view");
          });
        } else {
          toast.error(result.message || "Failed to create HR letter");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create HR letter");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/hr/payroll-setup/hr-letters/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Create Hr Letters Form</CardTitle>
            <CardDescription className="text-base">
              Fill in the details to create an HR letter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Employee/Letter Selection Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department">
                  Department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={handleDepartmentChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sub Department */}
              <div className="space-y-2">
                <Label htmlFor="subDepartment">
                  Sub Department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.subDepartment}
                  onValueChange={handleSubDepartmentChange}
                  disabled={
                    isPending ||
                    !formData.department ||
                    loadingSubDepartments
                  }
                >
                  <SelectTrigger id="subDepartment">
                    <SelectValue
                      placeholder={
                        loadingSubDepartments
                          ? "Loading..."
                          : !formData.department
                          ? "Select department first"
                          : subDepartments.length === 0
                          ? "No sub departments available"
                          : "Select Sub Department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subDepartments.length === 0 ? (
                      <SelectItem value="no-subdept" disabled>
                        {!formData.department
                          ? "Select department first"
                          : "No sub departments found"}
                      </SelectItem>
                    ) : (
                      subDepartments.map((subDept) => (
                        <SelectItem key={subDept.id} value={subDept.id}>
                          {subDept.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee */}
              <div className="space-y-2">
                <Label htmlFor="employee">
                  Employee <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, employeeId: value }))
                  }
                  disabled={isPending || !formData.department}
                >
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.length === 0 ? (
                      <SelectItem value="no-employee" disabled>
                        {!formData.department
                          ? "Select department first"
                          : "No employees found"}
                      </SelectItem>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.employeeId} -- {emp.employeeName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Letter Type */}
              <div className="space-y-2">
                <Label htmlFor="letterType">
                  Letter <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.letterTypeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, letterTypeId: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="letterType">
                    <SelectValue placeholder="Select Letter" />
                  </SelectTrigger>
                  <SelectContent>
                    {letterTypes.length > 0 ? (
                      letterTypes.map((letterType) => (
                        <SelectItem key={letterType.id} value={letterType.id}>
                          {letterType.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-letters" disabled>
                        No letter types available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Letter Head Content Section */}
            <div className="space-y-2">
              <Label htmlFor="letterHeadContent">Letter Head Content</Label>
              <TextEditor
                editorSerializedState={editorState}
                onSerializedChange={(value) => setEditorState(value)}
              />
            </div>

            {/* Note Section */}
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Enter notes"
                disabled={isPending}
                rows={4}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isPending} size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

