"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { useState, useEffect, useTransition, useRef, addTransitionType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Eye,
  Pencil,
  UserX,
  Upload,
  MoreHorizontal,
  Loader2,
  LayoutDashboard,
  MapPin,
  Download,
} from "lucide-react";
import {
  getEmployees,
  deleteEmployee,
  updateEmployee,
  queueEmployeesExport,
  type Employee,
} from "@/lib/actions/employee";
import { getDepartments, type Department } from "@/lib/actions/department";
import { getDesignations, type Designation } from "@/lib/actions/designation";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { EmployeeBulkUploadModal } from "@/components/employee/bulk-upload-modal";
import { ProtectedSalaryCell } from "@/components/common/protected-salary-cell";

export default function EmployeeListPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const hasFetchedRef = useRef(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [bulkUploadId, setBulkUploadId] = useState<string | null>(null);
  const [impersonatePendingId, setImpersonatePendingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  // Restore bulk upload session
  useEffect(() => {
    const savedId = sessionStorage.getItem("employee_upload_id");
    if (savedId) setBulkUploadId(savedId);
  }, []);

  const handleUploadIdChange = (id: string | null) => {
    setBulkUploadId(id);
    if (id) sessionStorage.setItem("employee_upload_id", id);
    else sessionStorage.removeItem("employee_upload_id");
  };

  // Fetch ALL employees once — no pagination limit
  const fetchAll = async () => {
    try {
      setLoading(true);
      const [empRes, deptRes, desigRes] = await Promise.all([
        getEmployees({ limit: 10000 }),
        getDepartments(),
        getDesignations(),
      ]);
      if (empRes.status) setEmployees(empRes.data ?? []);
      if (deptRes.status) setDepartments(deptRes.data ?? []);
      if (desigRes.status) setDesignations(desigRes.data ?? []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      // toast.error("Failed to fetch employee records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchAll();
  }, []);

  const getDepartmentName = (id: string | null | undefined) => {
    if (!id) return "N/A";
    return departments.find((d) => d.id === id)?.name ?? id;
  };

  const getDesignationName = (id: string | null | undefined) => {
    if (!id) return "N/A";
    return designations.find((d) => d.id === id)?.name ?? id;
  };

  const columns: ColumnDef<Employee>[] = [
    {
      accessorKey: "employeeId",
      header: "Employee ID",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("employeeId")}</div>
      ),
    },
    {
      accessorKey: "employeeName",
      header: "Employee Details",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium">{e.employeeName}</div>
            <div className="text-xs text-muted-foreground">{e.employeeId}</div>
            <div className="text-xs text-muted-foreground">
              {getDepartmentName(e.department)} • {getDesignationName(e.designation)}
            </div>
            <div className="text-xs text-muted-foreground">{e.contactNumber}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "bankName",
      header: "Bank Details",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="space-y-1">
            <div className="text-sm">{e.bankName ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{e.accountNumber}</div>
            <div className="text-xs text-muted-foreground">{e.accountTitle}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "cityName",
      header: "Address",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <div className="space-y-1">
            <div className="text-sm">{e.cityName ?? e.city ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{e.currentAddress}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "employeeSalary",
      header: "Salary",
      cell: ({ row }) => {
        const salary = parseFloat(row.getValue("employeeSalary"));
        return <ProtectedSalaryCell salary={salary} />;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={
              status === "active"
                ? "default"
                : status === "inactive"
                  ? "secondary"
                  : "destructive"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/hr/employee/view/${employee.id}`} transitionTypes={["nav-forward"]}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/hr/employee/edit/${employee.id}`} transitionTypes={["nav-forward"]}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/hr/employee/transfer?employeeId=${employee.id}`} transitionTypes={["nav-forward"]}>
                  <MapPin className="h-4 w-4 mr-2" />
                  Transfer
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className="flex w-full items-center"
                  onClick={() => handleDashboardAccess(employee)}
                  disabled={!!impersonatePendingId}
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  {impersonatePendingId === employee.id ? "Opening..." : "Dashboard Access"}
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusToggle(employee)}
                disabled={isPending}
              >
                <UserX className="h-4 w-4 mr-2" />
                {employee.status === "active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const handleStatusToggle = (employee: Employee) => {
    const newStatus = employee.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        const result = await updateEmployee(employee.id, { status: newStatus });
        if (result.status) {
          setEmployees((prev) =>
            prev.map((e) => (e.id === employee.id ? { ...e, status: newStatus } : e))
          );
          toast.success(
            `Employee ${newStatus === "active" ? "activated" : "deactivated"} successfully`
          );
        } else {
          toast.error(result.message || "Failed to update status");
        }
      } catch {
        toast.error("Failed to update status");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEmployee) return;
    startTransition(async () => {
      try {
        const result = await deleteEmployee(deletingEmployee.id);
        if (result.status) {
          setEmployees((prev) => prev.filter((e) => e.id !== deletingEmployee.id));
          toast.success(result.message || "Employee deleted successfully");
          setDeleteDialog(false);
        } else {
          toast.error(result.message || "Failed to delete employee");
        }
      } catch {
        toast.error("Failed to delete employee");
      }
    });
  };

  const handleDashboardAccess = async (employee: Employee) => {
    try {
      setImpersonatePendingId(employee.id);
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";
      const res = await fetch(`${apiBase}/auth/impersonate-by-employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.status) {
        toast.error(payload.message || "Failed to open dashboard.");
        return;
      }
      startTransition(() => {
        addTransitionType("nav-forward");
        router.push("/hr/employee/list");
        router.refresh();
      });
    } catch {
      toast.error("Failed to open dashboard");
    } finally {
      setImpersonatePendingId(null);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const result = await queueEmployeesExport();
      if (result.status) {
        toast.success("Export queued — you'll get a notification when your file is ready.", {
          duration: 6000,
        });
      } else {
        toast.error(result.message || "Failed to queue export");
      }
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PermissionGuard permissions="hr.employee.read">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Employees</h2>
            <p className="text-muted-foreground">Manage employee records</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting || employees.length === 0}
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isExporting ? "Queuing…" : "Export"}
            </Button>
            <Link href="/hr/employee/create" transitionTypes={["nav-forward"]}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => setUploadModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
          </div>
        </div>

        <DataTable
          data={employees}
          columns={columns}
          searchFields={[
            { key: "employeeName", label: "Employee Name" },
            { key: "employeeId", label: "Employee ID" },
            { key: "contactNumber", label: "Contact Number" },
          ]}
          isLoading={loading}
        />

        <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;
                {deletingEmployee?.employeeName}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <EmployeeBulkUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          uploadId={bulkUploadId}
          onUploadIdChange={handleUploadIdChange}
          onSuccess={fetchAll}
        />
      </div>
    </PermissionGuard>
  );
}
