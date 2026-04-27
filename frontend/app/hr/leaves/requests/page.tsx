"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import DataTable from "@/components/common/data-table";
import { Printer, Download, Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { getLeaveRequests, approveLeaveApplication, rejectLeaveApplication, type LeaveRequest, type LeaveRequestFilters } from "@/lib/actions/leave-requests";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { getEmployees, type Employee } from "@/lib/actions/employee";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAuth } from "@/components/providers/auth-provider";

const leaveStatusOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Options for dropdowns
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);

  const showFilters = user?.role?.name === 'admin' || user?.role?.name === 'hr';

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [deptsResult, employeesResult, requestsResult] = await Promise.all([
          getDepartments().catch(err => ({ status: false, message: err.message, data: [] })),
          getEmployees().catch(err => ({ status: false, message: err.message, data: [] })),
          getLeaveRequests(),
        ]);

        if (deptsResult.status && deptsResult.data) {
          setDepartments(deptsResult.data);
        } else if (showFilters) {
          toast.error(deptsResult.message || "Failed to load departments");
        }

        if (employeesResult.status && employeesResult.data) {
          setEmployees(employeesResult.data);
          setFilteredEmployees(employeesResult.data);
        } else if (showFilters) {
          toast.error(employeesResult.message || "Failed to load employees");
        }

        if (requestsResult.status && requestsResult.data) {
          setLeaveRequests(requestsResult.data);
        } else {
          toast.error(requestsResult.message || "Failed to load leave requests");
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
        setIsInitialLoad(false); // Mark initial load as complete
      }
    };

    fetchData();
  }, []);

  // Load sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (selectedDepartment && selectedDepartment !== "all") {
        try {
          const result = await getSubDepartmentsByDepartment(selectedDepartment);
          if (result.status && result.data) {
            setSubDepartments(result.data);
          }
        } catch (error) {
          console.error("Failed to fetch sub-departments:", error);
        }
      } else {
        setSubDepartments([]);
        setSelectedSubDepartment("all");
      }
    };

    fetchSubDepartments();
  }, [selectedDepartment]);

  // Auto-filter requests when filters change (after initial load)
  useEffect(() => {
    // Skip auto-filter on initial load
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const fetchFilteredRequests = async () => {
      try {
        setLoading(true);
        const filters: LeaveRequestFilters = {};
        
        if (selectedDepartment && selectedDepartment !== "all") {
          filters.departmentId = selectedDepartment;
        }
        if (selectedSubDepartment && selectedSubDepartment !== "all") {
          filters.subDepartmentId = selectedSubDepartment;
        }
        if (selectedEmployee && selectedEmployee !== "all") {
          filters.employeeId = selectedEmployee;
        }
        if (selectedStatus && selectedStatus !== "all") {
          filters.status = selectedStatus;
        }
        if (fromDate) {
          filters.fromDate = fromDate;
        }
        if (toDate) {
          filters.toDate = toDate;
        }

        const result = await getLeaveRequests(filters);
        if (result.status && result.data) {
          setLeaveRequests(result.data);
        } else {
          setLeaveRequests([]);
        }
      } catch (error) {
        console.error("Failed to fetch filtered requests:", error);
        setLeaveRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFilteredRequests();
  }, [selectedEmployee, selectedDepartment, selectedSubDepartment, selectedStatus, fromDate, toDate, isInitialLoad]);

  // Filter employees based on department and sub-department
  useEffect(() => {
    let filtered = employees;

    if (selectedDepartment && selectedDepartment !== "all") {
      const selectedDept = departments.find(d => d.id === selectedDepartment);
      filtered = filtered.filter((emp) => {
        const empDeptId = emp.department;
        const empDeptName = emp.departmentName || "";
        // Match by ID or name
        return empDeptId === selectedDepartment || 
               empDeptName === selectedDept?.name ||
               (selectedDept && empDeptId === selectedDept.id);
      });
    }

    if (selectedSubDepartment && selectedSubDepartment !== "all") {
      const selectedSubDept = subDepartments.find(sd => sd.id === selectedSubDepartment);
      filtered = filtered.filter((emp) => {
        const empSubDeptId = emp.subDepartment;
        const empSubDeptName = emp.subDepartmentName || "";
        // Match by ID or name
        return empSubDeptId === selectedSubDepartment ||
               empSubDeptName === selectedSubDept?.name ||
               (selectedSubDept && empSubDeptId === selectedSubDept.id);
      });
    }

    setFilteredEmployees(filtered);
    
    // Reset employee selection if current employee is not in filtered list
    if (selectedEmployee && selectedEmployee !== "all") {
      const employeeExists = filtered.some(emp => emp.id === selectedEmployee);
      if (!employeeExists) {
        setSelectedEmployee("all");
      }
    }
  }, [selectedDepartment, selectedSubDepartment, employees, departments, subDepartments, selectedEmployee]);

  // Auto-select department and sub-department when employee is selected
  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    
    if (employeeId && employeeId !== "all") {
      const employee = employees.find(emp => emp.id === employeeId);
      if (employee) {
        // Find department by ID or name
        const dept = departments.find(d => 
          d.id === employee.department || 
          d.name === employee.department ||
          d.name === employee.departmentName ||
          (employee.departmentName && d.name === employee.departmentName)
        );
        
        if (dept) {
          setSelectedDepartment(dept.id);
          
          // Load sub-departments and auto-select
          getSubDepartmentsByDepartment(dept.id).then(result => {
            if (result.status && result.data) {
              setSubDepartments(result.data);
              
              // Find matching sub-department by ID or name
              const subDept = result.data.find(sd => 
                sd.id === employee.subDepartment ||
                sd.name === employee.subDepartment ||
                sd.name === employee.subDepartmentName ||
                (employee.subDepartmentName && sd.name === employee.subDepartmentName)
              );
              
              if (subDept) {
                setSelectedSubDepartment(subDept.id);
              } else {
                setSelectedSubDepartment("all");
              }
            }
          });
        } else {
          // If department not found, reset to all
          setSelectedDepartment("all");
          setSelectedSubDepartment("all");
        }
      }
    } else {
      // Reset when "all" is selected
      setSelectedDepartment("all");
      setSelectedSubDepartment("all");
    }
  };

  // Handle search/filter
  const handleSearch = async () => {
    try {
      setLoading(true);
      const filters: LeaveRequestFilters = {};
      
      if (selectedDepartment && selectedDepartment !== "all") {
        filters.departmentId = selectedDepartment;
      }
      if (selectedSubDepartment && selectedSubDepartment !== "all") {
        filters.subDepartmentId = selectedSubDepartment;
      }
      if (selectedEmployee && selectedEmployee !== "all") {
        filters.employeeId = selectedEmployee;
      }
      if (selectedStatus && selectedStatus !== "all") {
        filters.status = selectedStatus;
      }
      if (fromDate) {
        filters.fromDate = fromDate;
      }
      if (toDate) {
        filters.toDate = toDate;
      }

      const result = await getLeaveRequests(filters);
      if (result.status && result.data) {
        setLeaveRequests(result.data);
        toast.success("Filters applied successfully");
      } else {
        toast.error(result.message || "Failed to filter leave requests");
      }
    } catch (error) {
      console.error("Failed to search:", error);
      toast.error("Failed to search leave requests");
    } finally {
      setLoading(false);
    }
  };

  // Handle print
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const tableRows = leaveRequests.map((req, index) => {
      const employeeId = req.employeeCode || req.employeeId || "";
      const employeeName = req.employeeName || "-";
      const employeeDisplay = employeeId ? `(${employeeId}) ${employeeName}` : employeeName;
      const fromDate = format(new Date(req.fromDate), "MM/dd/yyyy");
      const toDate = format(new Date(req.toDate), "MM/dd/yyyy");
      const dateRange = `${fromDate} - ${toDate}`;
      
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${employeeDisplay}</td>
        <td>${req.leaveTypeName || req.leaveType}</td>
        <td>${req.dayType}</td>
        <td>${dateRange}</td>
        <td>${req.approval1Status || "-"}</td>
        <td>${req.approval2 ? (req.approval2Status || "-") : "N/A"}</td>
        <td>${req.status || "-"}</td>
        <td>${req.remarks || "-"}</td>
      </tr>
    `;
    }).join("");

    printWindow.document.write(`
      <html><head><title>Leave Application Request Lists</title>
      <style>
        body{font-family:Arial;padding:20px}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-top:20px}
        th,td{border:1px solid #ddd;padding:8px;text-align:left}
        th{background:#f4f4f4;font-weight:bold}
        h1{text-align:center;margin-bottom:20px}
      </style>
      </head><body>
      <h1>Leave Application Request Lists</h1>
      <table>
        <thead>
          <tr>
            <th>S No.</th>
            <th>Employee</th>
            <th>Leave Type</th>
            <th>Day Type</th>
            <th>Date Range</th>
            <th>Approval 1</th>
            <th>Approval 2</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const headers = ["S No.", "Employee", "Leave Type", "Day Type", "Date Range", "Approval 1", "Approval 2", "Status", "Remarks"];
    const rows = leaveRequests.map((req, index) => {
      const employeeId = req.employeeCode || req.employeeId || "";
      const employeeName = req.employeeName || "-";
      const employeeDisplay = employeeId ? `(${employeeId}) ${employeeName}` : employeeName;
      const fromDate = format(new Date(req.fromDate), "MM/dd/yyyy");
      const toDate = format(new Date(req.toDate), "MM/dd/yyyy");
      const dateRange = `${fromDate} - ${toDate}`;
      
      return [
        index + 1,
        employeeDisplay,
        req.leaveTypeName || req.leaveType,
        req.dayType,
        dateRange,
        req.approval1Status || "-",
        req.approval2 ? (req.approval2Status || "-") : "N/A",
        req.status || "-",
        req.remarks || "-",
      ];
    });
    
    const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leave_requests_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("CSV exported successfully");
  };

  // Handle approve
  const handleApprove = async (id: string, level: 1 | 2) => {
    try {
      setProcessingId(id);
      const result = await approveLeaveApplication(id, level);
      if (result.status) {
        toast.success("Leave application approved successfully");
        // Refresh the list
        const filters: LeaveRequestFilters = {};
        if (selectedDepartment && selectedDepartment !== "all") filters.departmentId = selectedDepartment;
        if (selectedSubDepartment && selectedSubDepartment !== "all") filters.subDepartmentId = selectedSubDepartment;
        if (selectedEmployee && selectedEmployee !== "all") filters.employeeId = selectedEmployee;
        if (selectedStatus && selectedStatus !== "all") filters.status = selectedStatus;
        if (fromDate) filters.fromDate = fromDate;
        if (toDate) filters.toDate = toDate;
        
        const refreshResult = await getLeaveRequests(filters);
        if (refreshResult.status && refreshResult.data) {
          setLeaveRequests(refreshResult.data);
        }
      } else {
        toast.error(result.message || "Failed to approve leave application");
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("Failed to approve leave application");
    } finally {
      setProcessingId(null);
    }
  };

  // Handle reject
  const handleReject = async (id: string, level: 1 | 2) => {
    const remarks = prompt("Enter rejection remarks (optional):");
    if (remarks === null) return; // User cancelled
    
    try {
      setProcessingId(id);
      const result = await rejectLeaveApplication(id, remarks || undefined, level);
      if (result.status) {
        toast.success("Leave application rejected successfully");
        // Refresh the list
        const filters: LeaveRequestFilters = {};
        if (selectedDepartment && selectedDepartment !== "all") filters.departmentId = selectedDepartment;
        if (selectedSubDepartment && selectedSubDepartment !== "all") filters.subDepartmentId = selectedSubDepartment;
        if (selectedEmployee && selectedEmployee !== "all") filters.employeeId = selectedEmployee;
        if (selectedStatus && selectedStatus !== "all") filters.status = selectedStatus;
        if (fromDate) filters.fromDate = fromDate;
        if (toDate) filters.toDate = toDate;
        
        const refreshResult = await getLeaveRequests(filters);
        if (refreshResult.status && refreshResult.data) {
          setLeaveRequests(refreshResult.data);
        }
      } else {
        toast.error(result.message || "Failed to reject leave application");
      }
    } catch (error) {
      console.error("Failed to reject:", error);
      toast.error("Failed to reject leave application");
    } finally {
      setProcessingId(null);
    }
  };

  const normalizeStatus = (status?: string | null) => (status || "").toLowerCase();

  const renderApprovalStatus = (status?: string | null) => {
    const s = normalizeStatus(status);
    if (!s) return <span className="text-muted-foreground">-</span>;
    if (s === "approved") return <Badge variant="default">Approved</Badge>;
    if (s === "auto-approved") return <Badge variant="default">Auto Approved</Badge>;
    if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (s === "pending") return <Badge variant="secondary">Pending</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getPendingApprovalLevel = (request: LeaveRequest): 1 | 2 | null => {
    const overall = normalizeStatus(request.status);
    if (overall === "approved" || overall === "rejected") return null;

    if (normalizeStatus(request.approval1Status) !== "approved") return 1;

    if (request.approval2 && normalizeStatus(request.approval2Status) !== "approved") return 2;

    return null;
  };

  const getStatusVariant = (status?: string | null) => {
    if (!status) return "secondary";
    const statusLower = status.toLowerCase();
    if (statusLower === "approved") return "default";
    if (statusLower === "rejected") return "destructive";
    return "secondary";
  };

  // Table columns
  const columns: ColumnDef<LeaveRequest>[] = [
    {
      accessorKey: "index",
      header: "S No.",
      cell: ({ row }) => row.index + 1,
    },
    {
      accessorKey: "employeeName",
      header: "Employee",
      cell: ({ row }) => {
        const employeeName = row.original.employeeName || "-";
        const employeeId = row.original.employeeCode || row.original.employeeId || "";
        return (
          <div>
            <div className="font-medium">{employeeName}</div>
            {employeeId && <div className="text-xs text-muted-foreground">{employeeId}</div>}
          </div>
        );
      },
      size: 150,
    },
    {
      accessorKey: "leaveType",
      header: "Leave Type",
      cell: ({ row }) => row.original.leaveTypeName || row.original.leaveType,
    },
    {
      accessorKey: "dayType",
      header: "Day Type",
    },
    {
      accessorKey: "fromDate",
      header: "Date Range",
      cell: ({ row }) => {
        const fromDate = format(new Date(row.original.fromDate), "MM/dd/yyyy");
        const toDate = format(new Date(row.original.toDate), "MM/dd/yyyy");
        return `${fromDate} - ${toDate}`;
      },
      size: 180,
    },
    {
      accessorKey: "approval1Status",
      header: "Approval 1",
      cell: ({ row }) => {
        return renderApprovalStatus(row.original.approval1Status);
      },
    },
    {
      accessorKey: "approval2Status",
      header: "Approval 2",
      cell: ({ row }) => {
        if (!row.original.approval2) return <span className="text-muted-foreground">N/A</span>;
        return renderApprovalStatus(row.original.approval2Status);
      },
    },
    {
      accessorKey: "remarks",
      header: "Remarks",
      cell: ({ row }) => row.original.remarks || "-",
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => {
        const request = row.original;
        const isPending = normalizeStatus(request.status) === "pending";
        const isProcessing = processingId === request.id;
        const pendingLevel = getPendingApprovalLevel(request);
        const isAdmin = user?.role?.name === "admin";
        
        const canAct =
          isAdmin || 
          (pendingLevel === 1
            ? request.approval1 === user?.id
            : pendingLevel === 2
              ? request.approval2 === user?.id
              : false);
        
        return (
          <div className="flex items-center gap-2">
            {isPending && pendingLevel && canAct ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApprove(request.id, pendingLevel)}
                  disabled={isProcessing}
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve L{pendingLevel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(request.id, pendingLevel)}
                  disabled={isProcessing}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject L{pendingLevel}
                </Button>
              </>
            ) : (
              isPending ? (
                <Badge variant="secondary">
                  Pending{pendingLevel ? ` L${pendingLevel}` : ""}
                </Badge>
              ) : (
                <Badge variant={getStatusVariant(request.status)}>
                  {request.status}
                </Badge>
              )
            )}
          </div>
        );
      },
    },
  ];

  // Prepare filter options
  const departmentOptions = useMemo(() => [
    { value: "all", label: "All Departments" },
    ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
  ], [departments]);

  const subDepartmentOptions = useMemo(() => [
    { value: "all", label: "All Sub Departments" },
    ...subDepartments.map((subDept) => ({ value: subDept.id, label: subDept.name })),
  ], [subDepartments]);

  const employeeOptions = useMemo(() => [
    { value: "all", label: "All Employees" },
    ...filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeId} -- ${emp.employeeName}`,
    })),
  ], [filteredEmployees]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">View Leave Application Request Lists</h2>
          <p className="text-muted-foreground">Manage and view leave application requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {showFilters && (
      <Card>
        <CardHeader>
          <CardTitle>Filter Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Autocomplete
                options={departmentOptions}
                value={selectedDepartment}
                onValueChange={(value) => {
                  setSelectedDepartment(value);
                  setSelectedSubDepartment("all");
                  setSelectedEmployee("all");
                }}
                placeholder="Select Department"
                searchPlaceholder="Search Department..."
              />
            </div>

            <div className="space-y-2">
              <Label>Sub Department</Label>
              <Autocomplete
                options={subDepartmentOptions}
                value={selectedSubDepartment}
                onValueChange={(value) => {
                  setSelectedSubDepartment(value);
                  setSelectedEmployee("all");
                }}
                placeholder="Select Sub Department"
                searchPlaceholder="Search Sub Department..."
                disabled={!selectedDepartment || selectedDepartment === "all"}
              />
            </div>

            <div className="space-y-2">
              <Label>Employee *</Label>
              <Autocomplete
                options={employeeOptions}
                value={selectedEmployee}
                onValueChange={handleEmployeeChange}
                placeholder="Select Employee"
                searchPlaceholder="Search Employee..."
              />
            </div>

            <div className="space-y-2">
              <Label>Leaves Status</Label>
              <Autocomplete
                options={leaveStatusOptions}
                value={selectedStatus}
                onValueChange={setSelectedStatus}
                placeholder="Select Status"
                searchPlaceholder="Search Status..."
              />
            </div>

            <div className="space-y-2">
              <Label>From Date</Label>
              <DatePicker
                value={fromDate}
                onChange={setFromDate}
                placeholder="Select From Date"
              />
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <DatePicker
                value={toDate}
                onChange={setToDate}
                placeholder="Select To Date"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={leaveRequests}
            searchFields={[
              { key: "employeeName", label: "Employee Name" },
              { key: "employeeCode", label: "Employee ID" },
            ]}
            tableId="leave-request-list"
          />
        </CardContent>
      </Card>
    </div>
  );
}
