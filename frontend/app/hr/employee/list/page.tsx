"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { useState, useEffect, useTransition, useRef, startTransition, addTransitionType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  History,
  UserX,
  Upload,
  MoreHorizontal,
  Download,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
import {
  getEmployees,
  deleteEmployee,
  updateEmployee,
  type Employee,
} from "@/lib/actions/employee";
import { getDepartments, type Department } from "@/lib/actions/department";
import { getDesignations, type Designation } from "@/lib/actions/designation";
import { getCitiesByState, type City } from "@/lib/actions/city";
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

export default function EmployeeListPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const hasFetchedRef = useRef(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [bulkUploadId, setBulkUploadId] = useState<string | null>(null);
  const [impersonatePendingId, setImpersonatePendingId] = useState<string | null>(null);

  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [search, setSearch] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(
    null
  );

  // Dropdown data for mapping IDs to names
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [citiesMap, setCitiesMap] = useState<Record<string, City[]>>({});

  // Persistence of upload ID for session recovery
  useEffect(() => {
    const savedId = sessionStorage.getItem("employee_upload_id");
    if (savedId) setBulkUploadId(savedId);
  }, []);

  const handleUploadIdChange = (id: string | null) => {
    setBulkUploadId(id);
    if (id) {
      sessionStorage.setItem("employee_upload_id", id);
    } else {
      sessionStorage.removeItem("employee_upload_id");
    }
  };

  // Define columns for DataTable
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
        const employee = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium">{employee.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {employee.employeeId}
            </div>
            <div className="text-xs text-muted-foreground">
              {getDepartmentName(employee.department)} • {getDesignationName(employee.designation)}
            </div>
            <div className="text-xs text-muted-foreground">
              {employee.contactNumber}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "bankDetails",
      header: "Bank Details",
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="space-y-1">
            <div className="text-sm">{employee.bankName}</div>
            <div className="text-xs text-muted-foreground">
              {employee.accountNumber}
            </div>
            <div className="text-xs text-muted-foreground">
              {employee.accountTitle}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "address",
      header: "Address",
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="space-y-1">
            <div className="text-sm">{getCityName(employee.city, employee.province)}</div>
            <div className="text-xs text-muted-foreground">
              {employee.currentAddress}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "employeeSalary",
      header: "Salary",
      cell: ({ row }) => {
        const salary = parseFloat(row.getValue("employeeSalary"));
        return (
          <div className="font-medium">
            {new Intl.NumberFormat("en-PK", {
              style: "currency",
              currency: "PKR",
            }).format(salary)}
          </div>
        );
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

  const refreshEmployees = async (params?: { page?: number; limit?: number; search?: string }) => {
    try {
      setLoading(true);
      const employeesRes = await getEmployees({
        page: params?.page ?? pagination.pageIndex + 1,
        limit: params?.limit ?? pagination.pageSize,
        search: params?.search ?? search,
      });

      if (employeesRes.status && employeesRes.data) {
        setEmployees(employeesRes.data);
        if (employeesRes.meta) {
          setTotalRows(employeesRes.meta.total);
          setTotalPages(employeesRes.meta.totalPages);
        }
  
        // Fetch cities only for unique provinces found in employee data
        const uniqueProvinces = [...new Set(employeesRes.data.map(e => e.province).filter(Boolean))];
  
        if (uniqueProvinces.length > 0) {
          const citiesData: Record<string, City[]> = {};
          await Promise.all(
            uniqueProvinces.map(async (province) => {
              if (!province) return;
              try {
                const res = await getCitiesByState(province);
                if (res.status && res.data) {
                  citiesData[province] = res.data;
                }
              } catch (error) {
                console.error(`Error fetching cities for ${province}:`, error);
              }
            })
          );
          setCitiesMap(citiesData);
        }
      }
    } catch (error) {
      console.error("Error refreshing employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEmployees();
  }, [pagination.pageIndex, pagination.pageSize, search]);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchAllData = async () => {
      try {
        getDepartments().then(res => {
          if (res.status) setDepartments(res.data || []);
        });

        getDesignations().then(res => {
          if (res.status) setDesignations(res.data || []);
        });
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch records");
      }
    };

    fetchAllData();
  }, []);

  const getDepartmentName = (id: string | null | undefined) => {
    if (!id) return "N/A";
    const dept = departments.find(d => d.id === id);
    return dept?.name || id;
  };

  const getDesignationName = (id: string | null | undefined) => {
    if (!id) return "N/A";
    const designation = designations.find(d => d.id === id);
    return designation?.name || id;
  };

  const getCityName = (id: string | null | undefined, province: string | null | undefined) => {
    if (!id || !province) return "N/A";
    const cities = citiesMap[province] || [];
    const city = cities.find(c => c.id === id);
    return city?.name || id;
  };

  const handleStatusToggle = (employee: Employee) => {
    const newStatus = employee.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        const result = await updateEmployee(employee.id, {
          status: newStatus,
        });
        if (result.status) {
          setEmployees(
            employees.map((e) =>
              e.id === employee.id ? { ...e, status: newStatus } : e
            )
          );
          toast.success(
            `Employee ${newStatus === "active" ? "activated" : "deactivated"} successfully`
          );
        } else {
          toast.error(result.message || "Failed to update status");
        }
      } catch (error) {
        console.error("Error toggling employee status:", error);
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
          setEmployees(employees.filter((e) => e.id !== deletingEmployee.id));
          toast.success(result.message || "Employee deleted successfully");
          setDeleteDialog(false);
        } else {
          toast.error(result.message || "Failed to delete employee");
        }
      } catch (error) {
        console.error("Error deleting employee:", error);
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
    } catch (error) {
      console.error("Error impersonating user:", error);
      toast.error("Failed to open dashboard");
    } finally {
      setImpersonatePendingId(null);
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

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataTable
            data={employees}
            columns={columns}
            toggleAction={() => setUploadModalOpen(true)}
            actionText="Bulk Upload"
            searchFields={[
              { key: "employeeName", label: "Employee Name" },
              { key: "employeeId", label: "Employee ID" },
              { key: "contactNumber", label: "Contact Number" },
            ]}
            manualPagination={true}
            rowCount={totalRows}
            pageCount={totalPages}
            onPaginationChange={setPagination}
            onSearchChange={setSearch}
            isLoading={loading}
          />
        )}

        <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;
                {deletingEmployee?.employeeName}&quot;? This action cannot be
                undone.
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
          onSuccess={() => {
            refreshEmployees();
          }}
        />
      </div>
    </PermissionGuard>
  );
}
