"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import { getEmployees, type Employee } from "@/lib/actions/employee";
import { 
  getWorkingHoursPolicies, 
  getEmployeePolicyAssignments,
  getPolicyAssignments,
  createPolicyAssignment,
  deletePolicyAssignment,
  type WorkingHoursPolicy,
  type PolicyAssignment as APIPolicyAssignment 
} from "@/lib/actions/working-hours-policy";
import { getDepartments, type Department, type SubDepartment } from "@/lib/actions/department";
import { format, parseISO, isWithinInterval, eachDayOfInterval } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Policy Assignment Interface (local display)
interface PolicyAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  policyId: string;
  policyName: string;
  startDate: string;
  endDate: string;
  policyStartTime?: string;
  policyEndTime?: string;
}

export default function AssignWorkingHoursPage() {
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policies, setPolicies] = useState<WorkingHoursPolicy[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedSubDepartmentId, setSelectedSubDepartmentId] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [assignments, setAssignments] = useState<PolicyAssignment[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch departments, policies, employees, and all assignments on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [departmentsRes, policiesRes, employeesRes, assignmentsRes] = await Promise.all([
          getDepartments(),
          getWorkingHoursPolicies(),
          getEmployees(),
          getPolicyAssignments(),
        ]);

        if (departmentsRes.status && departmentsRes.data) {
          setDepartments(departmentsRes.data);
        }
        if (policiesRes.status && policiesRes.data) {
          setPolicies(policiesRes.data);
        }
        if (employeesRes.status && employeesRes.data) {
          setEmployees(employeesRes.data);
        }
        if (assignmentsRes.status && assignmentsRes.data) {
          const mappedAssignments: PolicyAssignment[] = assignmentsRes.data.map((a) => ({
            id: a.id,
            employeeId: a.employeeId,
            employeeName: a.employee?.employeeName || '',
            policyId: a.workingHoursPolicyId,
            policyName: a.workingHoursPolicy?.name || '',
            startDate: a.startDate,
            endDate: a.endDate,
            policyStartTime: a.workingHoursPolicy?.startWorkingHours,
            policyEndTime: a.workingHoursPolicy?.endWorkingHours,
          }));
          setAssignments(mappedAssignments);
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Extract sub-departments from selected department
  useEffect(() => {
    if (!selectedDepartmentId) {
      setSubDepartments([]);
      setSelectedSubDepartmentId("");
      return;
    }

    const selectedDepartment = departments.find((dept) => dept.id === selectedDepartmentId);
    if (selectedDepartment && selectedDepartment.subDepartments) {
      setSubDepartments(selectedDepartment.subDepartments);
    } else {
      setSubDepartments([]);
    }
    setSelectedSubDepartmentId("");
  }, [selectedDepartmentId, departments]);

  // Note: All assignments are fetched on page load
  // This effect only filters for employeeAssignments display, not replacing the full list

  // Filter employees based on selected filters
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (selectedDepartmentId) {
      const selectedDept = departments.find((d) => d.id === selectedDepartmentId);
      if (selectedDept) {
        result = result.filter(
          (emp) =>
            emp.departmentName === selectedDept.name ||
            emp.department === selectedDept.name ||
            emp.department === selectedDepartmentId
        );
      }
    }

    if (selectedSubDepartmentId) {
      const selectedSubDept = subDepartments.find((sd) => sd.id === selectedSubDepartmentId);
      if (selectedSubDept) {
        result = result.filter(
          (emp) =>
            emp.subDepartmentName === selectedSubDept.name ||
            emp.subDepartment === selectedSubDept.name ||
            emp.subDepartment === selectedSubDepartmentId
        );
      }
    }

    return result;
  }, [employees, selectedDepartmentId, selectedSubDepartmentId, departments, subDepartments]);

  const selectedEmployee = useMemo(() => {
    return filteredEmployees.find((e) => e.id === selectedEmployeeId) || employees.find((e) => e.id === selectedEmployeeId);
  }, [filteredEmployees, employees, selectedEmployeeId]);

  const selectedPolicy = useMemo(() => {
    return policies.find((p) => p.id === selectedPolicyId);
  }, [policies, selectedPolicyId]);

  const handleAssignPolicy = async () => {
    if (!selectedEmployeeId || !selectedPolicyId || !dateRange.from) {
      toast.error("Please select employee, policy, and date range");
      return;
    }

    setIsPending(true);
    try {
      const employee = employees.find((e) => e.id === selectedEmployeeId);
      const policy = policies.find((p) => p.id === selectedPolicyId);

      if (!employee || !policy) {
        toast.error("Invalid selection");
        return;
      }

      const endDate = dateRange.to || dateRange.from;

      const result = await createPolicyAssignment({
        employeeId: selectedEmployeeId,
        workingHoursPolicyId: selectedPolicyId,
        startDate: dateRange.from,
        endDate: endDate,
      });

      if (!result.status) {
        toast.error(result.message || "Failed to assign policy");
        return;
      }

      // Add to local state
      const newAssignment: PolicyAssignment = {
        id: result.data?.id || Date.now().toString(),
        employeeId: selectedEmployeeId,
        employeeName: employee.employeeName,
        policyId: selectedPolicyId,
        policyName: policy.name,
        startDate: dateRange.from.toISOString(),
        endDate: endDate.toISOString(),
        policyStartTime: policy.startWorkingHours,
        policyEndTime: policy.endWorkingHours,
      };

      setAssignments((prev) => [...prev, newAssignment]);
      toast.success(`Policy "${policy.name}" assigned to ${employee.employeeName}`);

      // Reset form
      setSelectedPolicyId("");
      setDateRange({ from: undefined, to: undefined });
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign policy");
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      const result = await deletePolicyAssignment(id);
      if (!result.status) {
        toast.error(result.message || "Failed to remove assignment");
        return;
      }
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Assignment removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove assignment");
    } finally {
      setDeleteId(null);
    }
  };

  // Employee assignments for the selected employee
  const employeeAssignments = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return assignments.filter((a) => a.employeeId === selectedEmployeeId);
  }, [assignments, selectedEmployeeId]);

  // Get disabled date ranges for the selected employee (dates already assigned)
  const disabledDateRanges = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return employeeAssignments.map((a) => ({
      from: parseISO(a.startDate),
      to: parseISO(a.endDate),
    }));
  }, [employeeAssignments, selectedEmployeeId]);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link href="/hr/working-hours">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Assign Working Hours Policy</h1>
        <div />
      </div>

      {/* Filter by Department/Sub-Department */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Employees</CardTitle>
          <CardDescription>Optionally filter employees by department and sub-department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Department Filter */}
            <div className="space-y-2">
              <Label>Department</Label>
              {loading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select
                  value={selectedDepartmentId || "all"}
                  onValueChange={(val) => setSelectedDepartmentId(val === "all" ? "" : val)}
                  disabled={isPending || loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Sub-Department Filter */}
            <div className="space-y-2">
              <Label>Sub-Department</Label>
              <Select
                value={selectedSubDepartmentId || "all"}
                onValueChange={(val) => setSelectedSubDepartmentId(val === "all" ? "" : val)}
                disabled={!selectedDepartmentId || isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedDepartmentId ? "All sub-departments" : "Select department first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sub-departments</SelectItem>
                  {subDepartments.map((subDept) => (
                    <SelectItem key={subDept.id} value={subDept.id}>
                      {subDept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assign Policy Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Assign Policy
          </CardTitle>
          <CardDescription>Select an employee, policy, and date range to assign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            {/* Row 1: Employee and Policy */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employee Selection */}
              <div className="space-y-2">
                <Label>
                  Employee <span className="text-red-500">*</span>
                </Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : (
                  <Autocomplete
                    options={filteredEmployees.map((e) => ({
                      value: e.id,
                      label: `${e.employeeName} (${e.employeeId})`,
                    }))}
                    value={selectedEmployeeId}
                    onValueChange={setSelectedEmployeeId}
                    placeholder="Search and select employee..."
                    emptyMessage="No employees found"
                    disabled={isPending}
                  />
                )}
              </div>

              {/* Policy Selection */}
              <div className="space-y-2">
                <Label className={!selectedEmployeeId ? "text-muted-foreground" : ""}>
                  Policy <span className="text-red-500">*</span>
                </Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded animate-pulse" />
                ) : (
                  <Select 
                    value={selectedPolicyId} 
                    onValueChange={setSelectedPolicyId} 
                    disabled={isPending || !selectedEmployeeId}
                  >
                    <SelectTrigger className={!selectedEmployeeId ? "opacity-50" : ""}>
                      <SelectValue placeholder={selectedEmployeeId ? "Select policy" : "Select employee first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {policies.map((policy) => (
                        <SelectItem key={policy.id} value={policy.id}>
                          <div className="flex flex-col">
                            <span>{policy.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {policy.startWorkingHours} - {policy.endWorkingHours}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Row 2: Date Range */}
            <div className="space-y-2">
              <Label className={!selectedEmployeeId ? "text-muted-foreground" : ""}>
                Date Range <span className="text-red-500">*</span>
              </Label>
              <DateRangePicker
                initialDateFrom={dateRange.from}
                initialDateTo={dateRange.to}
                onUpdate={({ range }) => {
                  setDateRange({ from: range.from, to: range.to });
                }}
                align="start"
                showCompare={false}
                isPreset={false}
                disabledDateRanges={disabledDateRanges}
                placeholder={selectedEmployeeId ? "Select date range for policy" : "Select employee first"}
                disabled={!selectedEmployeeId}
              />
            </div>

            {/* Selected Info */}
            {(selectedEmployee || selectedPolicy) && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                {selectedEmployee && (
                  <div className="text-sm">
                    <span className="font-medium">Employee:</span> {selectedEmployee.employeeName} ({selectedEmployee.employeeId})
                    {selectedEmployee.departmentName && (
                      <span className="text-muted-foreground"> • {selectedEmployee.departmentName}</span>
                    )}
                  </div>
                )}
                {selectedPolicy && (
                  <div className="text-sm">
                    <span className="font-medium">Policy:</span> {selectedPolicy.name} ({selectedPolicy.startWorkingHours} -{" "}
                    {selectedPolicy.endWorkingHours})
                  </div>
                )}
                {dateRange.from && (
                  <div className="text-sm">
                    <span className="font-medium">Period:</span> {format(dateRange.from, "MMM d, yyyy")}
                    {dateRange.to && dateRange.to !== dateRange.from && ` - ${format(dateRange.to, "MMM d, yyyy")}`}
                  </div>
                )}
              </div>
            )}

            {/* Assign Button */}
            <Button
              onClick={handleAssignPolicy}
              disabled={isPending || !selectedEmployeeId || !selectedPolicyId || !dateRange.from}
              className="w-full md:w-auto"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Plus className="h-4 w-4 mr-2" />
              Assign Policy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee's Assigned Policies - Always show when employee is selected */}
      {selectedEmployeeId && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  {selectedEmployee?.employeeName}&apos;s Assigned Policies
                </CardTitle>
                <CardDescription className="mt-1">
                  {employeeAssignments.length === 0 
                    ? "No policies assigned yet. Select a policy and date range above."
                    : `${employeeAssignments.length} policy assignment${employeeAssignments.length !== 1 ? "s" : ""}`
                  }
                </CardDescription>
              </div>
              {selectedEmployee?.workingHoursPolicyName && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Default Policy</p>
                  <p className="text-sm font-medium">{selectedEmployee.workingHoursPolicyName}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {employeeAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No custom policy assignments</p>
                <p className="text-xs mt-1">Assign policies above to override the default for specific date ranges</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employeeAssignments
                  .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                  .map((assignment) => {
                    const policy = policies.find((p) => p.id === assignment.policyId);
                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-1 rounded-full bg-primary" />
                          <div>
                            <p className="font-medium text-sm">{assignment.policyName}</p>
                            {policy && (
                              <p className="text-xs text-muted-foreground">
                                {policy.startWorkingHours} - {policy.endWorkingHours}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {format(parseISO(assignment.startDate), "MMM d")} - {format(parseISO(assignment.endDate), "MMM d, yyyy")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Math.ceil((new Date(assignment.endDate).getTime() - new Date(assignment.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Assignments Summary - Always visible */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>All Assignments Summary</CardTitle>
          <CardDescription>Overview of all policy assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No policy assignments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">{assignment.employeeName}</TableCell>
                    <TableCell>{assignment.policyName}</TableCell>
                    <TableCell>
                      {format(parseISO(assignment.startDate), "MMM d, yyyy")} -{" "}
                      {format(parseISO(assignment.endDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(assignment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the policy assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDeleteAssignment(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
