"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload, Download } from "lucide-react";
import Link from "next/link";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { getEmployeesForAttendance, type EmployeeForAttendance } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { createAttendance, createAttendanceForDateRange, type Attendance } from "@/lib/actions/attendance";
import { AttendanceBulkUploadModal } from "@/components/attendance/attendance-bulk-upload-modal";
import { format, eachDayOfInterval, isWeekend, isWithinInterval, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getHolidays } from "@/lib/actions/holiday";
import { getLeaveRequests } from "@/lib/actions/leave-requests";
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
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { DirectionalTransition } from "@/components/layouts/directional-transition";

export default function AttendanceManagePage() {
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EmployeeForAttendance[]>([]);
  const [knownEmployees, setKnownEmployees] = useState<Map<string, EmployeeForAttendance>>(new Map());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [leaveConfirmDialog, setLeaveConfirmDialog] = useState(false);
  const [leaveDates, setLeaveDates] = useState<Array<{ date: Date; type: string; name?: string }>>([]);
  const [pendingSubmit, setPendingSubmit] = useState<((includeLeaves: boolean) => void) | null>(null);

  const [formData, setFormData] = useState({
    employeeIds: [] as string[],
    employeeName: "",
    departmentId: "",
    subDepartmentId: "",
    dateRange: {
      from: new Date(),
      to: new Date(),
    } as DateRange,
    checkIn: "",
    checkOut: "",
    status: "present",
    isRemote: false,
    location: "",
    notes: "",
  });

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeForAttendance | null>(null);

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const result = await getDepartments();
        if (result.status && result.data) {
          setDepartments(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };
    fetchDepartments();
  }, []);

  // Reset page when filters or search change
  useEffect(() => {
    setPage(1);
    setSearchResults([]);
  }, [formData.departmentId, formData.subDepartmentId, searchQuery]);

  // Fetch employees with server-side pagination and search
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const result = await getEmployeesForAttendance({
          departmentId: formData.departmentId || undefined,
          subDepartmentId: formData.subDepartmentId || undefined,
          search: searchQuery || undefined,
          page: page,
          limit: 100
        });

        if (result.status && result.data) {
          if (page === 1) {
            setSearchResults(result.data);
          } else {
            setSearchResults(prev => [...prev, ...result.data!]);
          }

          setHasMore(result.meta ? result.meta.page < result.meta.totalPages : false);

          setKnownEmployees(prev => {
            const next = new Map(prev);
            result.data!.forEach(emp => next.set(emp.id, emp));
            return next;
          });
        } else {
          if (page === 1) setSearchResults([]);
          if (result.message) toast.error(result.message);
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to load employees");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [formData.departmentId, formData.subDepartmentId, searchQuery, page]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  // Combine search results with already selected employees so their labels render correctly
  const displayEmployees = useMemo(() => {
    const map = new Map<string, EmployeeForAttendance>();

    // Always include selected employees
    formData.employeeIds.forEach(id => {
      const emp = knownEmployees.get(id);
      if (emp) map.set(id, emp);
    });

    // Include current search results
    searchResults.forEach(emp => {
      map.set(emp.id, emp);
    });

    return Array.from(map.values());
  }, [searchResults, formData.employeeIds, knownEmployees]);

  // Fetch sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (formData.departmentId) {
        try {
          const result = await getSubDepartmentsByDepartment(formData.departmentId);
          if (result.status && result.data) {
            setSubDepartments(result.data);
          } else {
            setSubDepartments([]);
          }
        } catch (error) {
          console.error("Failed to fetch sub-departments:", error);
          setSubDepartments([]);
        }
      } else {
        setSubDepartments([]);
        setFormData((prev) => ({ ...prev, subDepartmentId: "", employeeIds: [], employeeName: "" }));
      }
    };

    fetchSubDepartments();
  }, [formData.departmentId]);

  // Reset sub-department and employee when department changes
  useEffect(() => {
    if (formData.departmentId) {
      setFormData((prev) => ({ ...prev, subDepartmentId: "", employeeIds: [], employeeName: "" }));
      setSelectedEmployee(null);
    }
  }, [formData.departmentId]);

  // Reset employee when sub-department changes
  useEffect(() => {
    if (formData.subDepartmentId) {
      setFormData((prev) => ({ ...prev, employeeIds: [], employeeName: "" }));
      setSelectedEmployee(null);
    }
  }, [formData.subDepartmentId]);

  const handleDepartmentChange = (departmentId: string) => {
    const actualDepartmentId = departmentId === "all" ? "" : departmentId;
    setFormData((prev) => ({
      ...prev,
      departmentId: actualDepartmentId,
      subDepartmentId: "",
      employeeIds: [],
      employeeName: "",
    }));
    setSelectedEmployee(null);
  };

  const handleSubDepartmentChange = (subDepartmentId: string) => {
    const actualSubDepartmentId = subDepartmentId === "all" ? "" : subDepartmentId;
    setFormData((prev) => ({
      ...prev,
      subDepartmentId: actualSubDepartmentId,
      employeeIds: [],
      employeeName: "",
    }));
    setSelectedEmployee(null);
  };

  const handleEmployeeChange = (employeeIds: string[]) => {
    setFormData((prev) => ({
      ...prev,
      employeeIds,
      employeeName: employeeIds.length === 1
        ? knownEmployees.get(employeeIds[0])?.employeeName || ""
        : `${employeeIds.length} employees selected`,
    }));

    // If single employee selected, set selectedEmployee and policy defaults
    if (employeeIds.length === 1) {
      const selected = knownEmployees.get(employeeIds[0]);
      if (selected) {
        setSelectedEmployee(selected);

        // Set default clock in/out times from working hours policy
        const policy = selected.workingHoursPolicy;
        if (policy) {
          setFormData((prev) => ({
            ...prev,
            checkIn: policy.startWorkingHours || "",
            checkOut: policy.endWorkingHours || "",
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            checkIn: "",
            checkOut: "",
          }));
        }
      }
    } else {
      setSelectedEmployee(null);
    }
  };

  // Check for leave days in date range
  const checkForLeaveDays = async (fromDate: Date, toDate: Date, employeeId: string): Promise<Array<{ date: Date; type: string; name?: string }>> => {
    const dates: Array<{ date: Date; type: string; name?: string }> = [];
    const allDays = eachDayOfInterval({ start: fromDate, end: toDate });

    // Get leave requests for the employee
    const leaveRequestsResult = await getLeaveRequests({
      employeeId,
      fromDate: format(fromDate, 'yyyy-MM-dd'),
      toDate: format(toDate, 'yyyy-MM-dd'),
      status: 'approved', // Only check approved leaves
    });
    const leaveRequests = leaveRequestsResult.status && leaveRequestsResult.data ? leaveRequestsResult.data : [];

    for (const day of allDays) {
      // Check if leave day
      const leaveRequest = leaveRequests.find(lr => {
        const leaveFrom = parseISO(lr.fromDate);
        const leaveTo = parseISO(lr.toDate);
        return isWithinInterval(day, { start: leaveFrom, end: leaveTo });
      });

      if (leaveRequest) {
        dates.push({
          date: day,
          type: 'Leave Day',
          name: leaveRequest.leaveTypeName || 'Leave',
        });
      }
    }

    return dates;
  };


  const handleSubmitInternal = async (includeLeaves: boolean = false) => {
    const fromDate = formData.dateRange.from;
    const toDate = formData.dateRange.to;

    if (!fromDate || !toDate) {
      toast.error("Please fill all required fields (Employee and Date Range)");
      setIsPending(false);
      return;
    }

    const isSingleDate = format(fromDate, 'yyyy-MM-dd') === format(toDate, 'yyyy-MM-dd');

    setIsPending(true);
    try {
      const employeesToProcess = displayEmployees.filter(e => formData.employeeIds.includes(e.id));

      if (employeesToProcess.length === 0) {
        toast.error("No employees selected to create attendance for");
        setIsPending(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ employee: string; error: string }> = [];

      for (const employee of employeesToProcess) {
        try {
          if (isSingleDate) {
            const checkInDateTime = formData.checkIn
              ? new Date(`${format(fromDate, 'yyyy-MM-dd')}T${formData.checkIn}`)
              : undefined;
            const checkOutDateTime = formData.checkOut
              ? new Date(`${format(fromDate, 'yyyy-MM-dd')}T${formData.checkOut}`)
              : undefined;

            const result = await createAttendance({
              employeeId: employee.id,
              date: fromDate,
              checkIn: checkInDateTime,
              checkOut: checkOutDateTime,
              status: formData.status,
              isRemote: formData.isRemote,
              location: formData.location || undefined,
              notes: formData.notes || undefined,
            });

            if (result.status) {
              successCount++;
            } else {
              errorCount++;
              errors.push({ employee: employee.employeeName, error: result.message || "Unknown error" });
            }
          } else {
            const result = await createAttendanceForDateRange({
              employeeId: employee.id,
              fromDate: fromDate,
              toDate: toDate,
              checkIn: formData.checkIn || undefined,
              checkOut: formData.checkOut || undefined,
              status: formData.status,
              isRemote: formData.isRemote,
              location: formData.location || undefined,
              notes: formData.notes || undefined,
            });

            if (result.status) {
              successCount += result.data?.length || 0;
              errorCount += result.errors?.length || 0;
            } else {
              errorCount++;
              errors.push({ employee: employee.employeeName, error: result.message || "Unknown error" });
            }
          }
        } catch (error) {
          errorCount++;
          errors.push({ employee: employee.employeeName, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }

      if (errorCount > 0) {
        toast.warning(
          `${successCount} records created, ${errorCount} failed`,
          {
            description: `Processed ${employeesToProcess.length} employees. Check console for details.`,
            duration: 6000,
          }
        );
        console.error("Failed records:", errors);
      } else {
        toast.success(
          `${successCount} attendance records created successfully!`,
          {
            description: `Processed ${employeesToProcess.length} employees`,
            duration: 5000,
          }
        );
      }

      // Reset form
      setFormData({
        employeeIds: [],
        employeeName: "",
        departmentId: "",
        subDepartmentId: "",
        dateRange: {
          from: new Date(),
          to: new Date(),
        } as DateRange,
        checkIn: "",
        checkOut: "",
        status: "present",
        isRemote: false,
        location: "",
        notes: "",
      });
      setSelectedEmployee(null);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to create attendance record");
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.employeeIds.length === 0 || !formData.dateRange.from || !formData.dateRange.to) {
      toast.error("Please fill all required fields (Employee and Date Range)");
      return;
    }

    const fromDate = formData.dateRange.from;
    const toDate = formData.dateRange.to;
    const isSingleDate = format(fromDate, 'yyyy-MM-dd') === format(toDate, 'yyyy-MM-dd');

    // For date ranges, check for leave days before submitting (only for single employee selection)
    if (!isSingleDate && formData.employeeIds.length === 1) {
      const leaveDatesFound = await checkForLeaveDays(fromDate, toDate, formData.employeeIds[0]);

      if (leaveDatesFound.length > 0) {
        setLeaveDates(leaveDatesFound);
        setPendingSubmit(() => (includeLeaves: boolean) => {
          handleSubmitInternal(includeLeaves);
        });
        setLeaveConfirmDialog(true);
        return;
      }
    }

    // No leave days found or multiple employees, proceed normally
    handleSubmitInternal(true);
  };

  // Old validateCSVFormat and handleFileUpload logic has been removed as it is now handled by AttendanceBulkUploadModal



  return (
    <DirectionalTransition>
      <div className="max-w-4xl mx-auto pb-10">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/hr/attendance" transitionTypes={["nav-back"]}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => setUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Attendance File
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employee Selection - All in one line */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Selection</CardTitle>
              <CardDescription>
                Select department, sub-department, and employee (all employees shown by default)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Department */}
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={formData.departmentId || "all"}
                    onValueChange={handleDepartmentChange}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
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
                  <Label>Sub Department</Label>
                  <Select
                    value={formData.subDepartmentId || "all"}
                    onValueChange={handleSubDepartmentChange}
                    disabled={isPending || !formData.departmentId || formData.departmentId === "all"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Sub Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sub Departments</SelectItem>
                      {subDepartments.map((subDept) => (
                        <SelectItem key={subDept.id} value={subDept.id}>
                          {subDept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Employee */}
                <div className="space-y-2">
                  <Label>Employee <span className="text-red-500">*</span></Label>
                  {loading ? (
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  ) : (
                    <MultiSelect
                      options={displayEmployees.map((e) => ({
                        value: e.id,
                        label: e.employeeName,
                        description: `${e.employeeId}${e.department?.name ? ` • ${e.department.name}` : ""}`
                      }))}
                      value={formData.employeeIds}
                      onValueChange={handleEmployeeChange}
                      onSearch={setSearchQuery}
                      onLoadMore={handleLoadMore}
                      hasMore={hasMore}
                      isLoading={loading}
                      placeholder="Select employees..."
                      searchPlaceholder="Search employee..."
                      emptyMessage={searchQuery ? "No employees found" : "Type to search employees..."}
                      disabled={isPending || (loading && page === 1)}
                      maxDisplayedItems={5}
                    />
                  )}
                </div>
              </div>

              {/* Show selected employee info and working hours policy */}
              {selectedEmployee && (
                <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    {selectedEmployee.department && (
                      <div>
                        <span className="text-muted-foreground">Department: </span>
                        <span className="font-medium">{selectedEmployee.department.name}</span>
                      </div>
                    )}
                    {selectedEmployee.subDepartment && (
                      <div>
                        <span className="text-muted-foreground">Sub Department: </span>
                        <span className="font-medium">{selectedEmployee.subDepartment.name}</span>
                      </div>
                    )}
                  </div>
                  {selectedEmployee.workingHoursPolicy && (
                    <>
                      <p className="text-sm font-medium">
                        Working Hours Policy: {selectedEmployee.workingHoursPolicy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Default: {selectedEmployee.workingHoursPolicy.startWorkingHours} - {selectedEmployee.workingHoursPolicy.endWorkingHours}
                      </p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date Range */}
          <Card>
            <CardHeader>
              <CardTitle>Date Range</CardTitle>
              <CardDescription>
                Select the date or date range for attendance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Date Range <span className="text-red-500">*</span></Label>
                <DateRangePicker
                  initialDateFrom={formData.dateRange.from}
                  initialDateTo={formData.dateRange.to}
                  showCompare={false}
                  onUpdate={(values) => {
                    if (values.range) {
                      setFormData({
                        ...formData,
                        dateRange: values.range,
                      });
                    }
                  }}
                  dateRange={undefined}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attendance Details */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Details</CardTitle>
              <CardDescription>
                Enter check-in/check-out times and other details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Time Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Check In Time */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Check In Time</Label>
                    {selectedEmployee?.workingHoursPolicy && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Policy default: {selectedEmployee.workingHoursPolicy.startWorkingHours}
                      </p>
                    )}
                  </div>
                  <TimePicker
                    value={formData.checkIn}
                    onChange={(value: string) => setFormData({ ...formData, checkIn: value })}
                    disabled={isPending}
                    placeholder="Select check-in time"
                  />
                </div>

                {/* Check Out Time */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold">Check Out Time</Label>
                    {selectedEmployee?.workingHoursPolicy && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Policy default: {selectedEmployee.workingHoursPolicy.endWorkingHours}
                      </p>
                    )}
                  </div>
                  <TimePicker
                    value={formData.checkOut}
                    onChange={(value: string) => setFormData({ ...formData, checkOut: value })}
                    disabled={isPending}
                    placeholder="Select check-out time"
                  />
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Tabs
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as "present" | "absent" })}
                  className="w-full"
                  color="primary"
                  variant="card"
                >
                  <TabsList className="grid w-full grid-cols-2 h-12">
                    <TabsTrigger value="present" className="text-base font-medium" disabled={isPending}>
                      Present
                    </TabsTrigger>
                    <TabsTrigger value="absent" className="text-base font-medium" disabled={isPending}>
                      Absent
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Additional Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t">
                {/* Remote Work */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Remote Work</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <Switch
                      id="isRemote"
                      checked={formData.isRemote}
                      onCheckedChange={(checked) => setFormData({ ...formData, isRemote: checked })}
                      disabled={isPending}
                    />
                    <Label htmlFor="isRemote" className="text-sm font-medium cursor-pointer flex-1">
                      {formData.isRemote ? "Working Remotely" : "On-Site"}
                    </Label>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-3">
                  <Label htmlFor="location" className="text-sm font-semibold">Location</Label>
                  <Input
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Office, Client Site, Remote"
                    disabled={isPending}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-3 pt-2 border-t">
                <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or remarks..."
                  rows={4}
                  disabled={isPending}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  employeeIds: [],
                  employeeName: "",
                  departmentId: "",
                  subDepartmentId: "",
                  dateRange: {
                    from: new Date(),
                    to: new Date(),
                  } as DateRange,
                  checkIn: "",
                  checkOut: "",
                  status: "present",
                  isRemote: false,
                  location: "",
                  notes: "",
                });
                setSelectedEmployee(null);
              }}
              disabled={isPending}
            >
              Clear
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Attendance
            </Button>
          </div>
        </form>

        <AttendanceBulkUploadModal
          open={uploadDialog}
          onOpenChange={setUploadDialog}
          uploadId={uploadId}
          onUploadIdChange={setUploadId}
          onSuccess={() => {
            // Assuming there's a list we could refresh, or we just close.
            setUploadDialog(false);
          }}
        />

        {/* Leave Day Confirmation Dialog */}
        <AlertDialog open={leaveConfirmDialog} onOpenChange={setLeaveConfirmDialog}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Days Detected</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  The selected date range includes {leaveDates.length} day(s) that are approved Leave Days.
                </p>
                <div className="max-h-60 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {leaveDates.map((ld, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{format(ld.date, 'EEEE, MMM dd, yyyy')}</span>
                      <Badge variant="default">
                        {ld.type}{ld.name ? `: ${ld.name}` : ''}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="font-medium mt-2">
                  Do you want to mark attendance for these days as well?
                </p>
                <p className="text-xs text-muted-foreground">
                  If you select "Yes", attendance will be marked for all days including leave days (overwriting the leave).
                  If you select "No", leave days will be skipped.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setLeaveConfirmDialog(false);
                if (pendingSubmit) {
                  pendingSubmit(false);
                  setPendingSubmit(null);
                }
                setLeaveDates([]);
              }}>
                No, Skip Leave Days
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setLeaveConfirmDialog(false);
                  if (pendingSubmit) {
                    pendingSubmit(true);
                    setPendingSubmit(null);
                  }
                }}
                className="bg-primary"
              >
                Yes, Overwrite Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DirectionalTransition>
  );
}

