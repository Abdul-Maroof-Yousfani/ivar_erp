"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Employee } from "@/lib/actions/employee";
import type { Role } from "@/lib/actions/roles";
import type { User } from "@/lib/actions/users";
import { updateUserRole, createUser, resetUserPassword, updateUserPermissionsAndRoleExpiry } from "@/lib/actions/users";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, LayoutDashboard, KeyRound, ShieldAlert, ShieldCheck, ShieldX, Search, Calendar, Clock, FolderOpen, Shield, AlertCircle } from "lucide-react";
import Link from "next/link";
import { ManagerVerificationDialog } from "@/components/auth/manager-verification-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

interface Row {
  employeeId: string;
  employeeCode: string;
  userId: string | null;
  roleId: string | null;
  employeeName: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  isDashboardEnabled: boolean;
}

interface Props {
  employees: Employee[];
  users: User[];
  roles: Role[];
  allPermissions: any[];
  userPermissions: string[];
  userRole?: string | null;
}

export function EmployeeUserList({
  employees,
  users,
  roles,
  allPermissions,
  userPermissions,
  userRole,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [savingForId, setSavingForId] = useState<string | null>(null);
  const [impersonatePendingId, setImpersonatePendingId] = useState<
    string | null
  >(null);

  // Reset password state
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetRow, setResetTargetRow] = useState<Row | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, startResetTransition] = useTransition();

  // Overrides and expiration state
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsTargetRow, setPermissionsTargetRow] = useState<Row | null>(null);
  const [targetUserRoleExpiresAt, setTargetUserRoleExpiresAt] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, { isAllowed: boolean; expiresAt: string }>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isSavingPermissions, startSavingPermissionsTransition] = useTransition();
  const [activePermissionTab, setActivePermissionTab] = useState<"HR" | "Master" | "ERP" | "POS">("HR");
  const [masterFilter, setMasterFilter] = useState<"All" | "HR" | "ERP" | "POS">("All");

  const getRelativeTimeDesc = (dateStr: string) => {
    if (!dateStr) return "";
    const target = new Date(dateStr);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs < 0) return "already expired";

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `in ${diffMins} min${diffMins > 1 ? 's' : ''}`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours} hr${diffHours > 1 ? 's' : ''}`;

    const diffDays = Math.floor(diffHours / 24);
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  };

  const roleName = (userRole || "").toLowerCase().trim();
  const isAdminRole =
    roleName === "admin" ||
    roleName === "super_admin" ||
    roleName === "super admin" ||
    roleName === "super-admin";
  const canCreate = isAdminRole || userPermissions.includes("user.create");
  const canUpdate = isAdminRole || userPermissions.includes("user.update");

  const userByEmployeeId = new Map<string, User>();
  for (const u of users) {
    if (u.employee?.id) {
      userByEmployeeId.set(u.employee.id, u);
    } else if (u.employeeId) {
      userByEmployeeId.set(u.employeeId, u);
    }
  }

  const rows: Row[] = employees.map((e) => {
    const matchedUser = userByEmployeeId.get(e.id) || null;
    const email = matchedUser?.email || e.officialEmail || "";
    return {
      employeeId: e.id,
      employeeCode: e.employeeId,
      userId: matchedUser?.id || null,
      roleId: matchedUser?.role?.id || null,
      employeeName: e.employeeName,
      email,
      department: e.departmentName || e.department || "N/A",
      designation: e.designationName || e.designation || "N/A",
      status: e.status,
      isDashboardEnabled: matchedUser?.isDashboardEnabled || false,
    };
  });

  // If coming from Employee List with a specific employeeId, show only that employee's user row
  const employeeIdParam = searchParams.get("employeeId");
  const visibleRows = employeeIdParam
    ? rows.filter((r) => r.employeeId === employeeIdParam)
    : rows;

  const handleAssign = (row: Row, newRoleId: string | null) => {
    if (!canUpdate) return;

    if (!row.userId) {
      if (!canCreate) {
        toast.error("You don't have permission to create user accounts");
        return;
      }
      if (!row.email) {
        toast.error("Official email not set for this employee");
        return;
      }
      const parts = row.employeeName.trim().split(" ");
      const firstName = parts[0] || row.employeeName;
      const lastName = parts.slice(1).join(" ") || "";

      setSavingForId(row.employeeId);
      startTransition(async () => {
        const result = await createUser({
          email: row.email,
          firstName,
          lastName,
          employeeId: row.employeeId,
          roleId: newRoleId || undefined,
        });
        if (result.status) {
          toast.success("User account created and role assigned");
          window.location.reload();
        } else {
          toast.error(result.message || "Failed to create user");
        }
        setSavingForId(null);
      });
    } else {
      setSavingForId(row.employeeId);
      startTransition(async () => {
        const result = await updateUserRole(row.userId!, newRoleId);
        if (result.status) {
          toast.success("Role updated successfully");
          router.refresh();
        } else {
          toast.error(result.message || "Failed to update role");
        }
        setSavingForId(null);
      });
    }
  };

  // Opens the manager verification dialog before showing the reset form
  const handleResetPasswordClick = (row: Row) => {
    if (!row.userId) {
      toast.error("No user account linked to this employee");
      return;
    }
    setResetTargetRow(row);
    setNewPassword("");
    setConfirmPassword("");
    setVerifyDialogOpen(true);
  };

  // Called after manager verification passes — show the new-password form
  const handleVerified = () => {
    setResetDialogOpen(true);
  };

  // Performs the actual password reset
  const handleConfirmReset = () => {
    if (!newPassword) {
      toast.error("New password is required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!resetTargetRow?.userId) return;

    startResetTransition(async () => {
      const result = await resetUserPassword(resetTargetRow.userId!, newPassword);
      if (result.status) {
        toast.success(`Password reset for ${resetTargetRow.employeeName}. They will be prompted to change it on next login.`);
        setResetDialogOpen(false);
        setResetTargetRow(null);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.message || "Failed to reset password");
      }
    });
  };

  const handleManagePermissionsClick = (row: Row) => {
    if (!row.userId) {
      toast.error("No user account linked to this employee");
      return;
    }

    const matchedUser = users.find(u => u.id === row.userId);
    if (!matchedUser) {
      toast.error("User details not found");
      return;
    }

    setPermissionsTargetRow(row);

    const roleExpiry = matchedUser.roleExpiresAt
      ? new Date(matchedUser.roleExpiresAt).toISOString().slice(0, 16)
      : "";
    setTargetUserRoleExpiresAt(roleExpiry);

    const initialOverrides = {};
    if (matchedUser.userPermissions) {
      matchedUser.userPermissions.forEach(up => {
        initialOverrides[up.permissionId] = {
          isAllowed: up.isAllowed,
          expiresAt: up.expiresAt ? new Date(up.expiresAt).toISOString().slice(0, 16) : ""
        };
      });
    }
    setOverrides(initialOverrides);
    setSearchTerm("");
    setPermissionsDialogOpen(true);
  };

  const handleSavePermissions = () => {
    if (!permissionsTargetRow?.userId) return;

    const formattedOverrides = Object.entries(overrides).map(([permissionId, data]) => ({
      permissionId,
      isAllowed: data.isAllowed,
      expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : null
    }));

    const roleExpiryDate = targetUserRoleExpiresAt ? new Date(targetUserRoleExpiresAt).toISOString() : null;

    startSavingPermissionsTransition(async () => {
      const result = await updateUserPermissionsAndRoleExpiry(
        permissionsTargetRow.userId!,
        permissionsTargetRow.roleId,
        roleExpiryDate,
        formattedOverrides
      );

      if (result.status) {
        toast.success("User permissions and role expiration updated successfully");
        setPermissionsDialogOpen(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update permissions");
      }
    });
  };

  const handleDashboardAccess = async (row: Row) => {
    try {
      setImpersonatePendingId(row.employeeId);

      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001/api";

      const res = await fetch(`${apiBase}/auth/impersonate-by-employee`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ employeeId: row.employeeId }),
      });

      const payload = await res.json();

      if (!res.ok || !payload.status) {
        toast.error(
          payload.message ||
          "Failed to open dashboard. Make sure user account & dashboard access exist.",
        );
        return;
      }

      // Navigate in the same tab so the impersonation banner is visible
      window.location.href = "/hr";
    } catch (error) {
      console.error("Error impersonating user:", error);
      toast.error("Failed to open dashboard");
    } finally {
      setImpersonatePendingId(null);
    }
  };

  const columns: ColumnDef<Row>[] = [
    {
      accessorKey: "employeeCode",
      header: "Employee ID",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("employeeCode")}</div>
      ),
    },
    {
      accessorKey: "employeeName",
      header: "Employee Details",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium">{r.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {r.department} • {r.designation}
            </div>
          </div>
        );
      },
    },
    { accessorKey: "email", header: "Email / Username" },
    {
      accessorKey: "roleId",
      header: "Assigned Role",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Select
            value={r.roleId || "none"}
            onValueChange={(value) =>
              handleAssign(r, value === "none" ? null : value)
            }
            disabled={!canUpdate || isPending || savingForId === r.employeeId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Role</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "default" : "destructive"}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const r = row.original;
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
                <button
                  type="button"
                  className="flex w-full items-center"
                  onClick={() => handleDashboardAccess(r)}
                  disabled={!!impersonatePendingId}
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  {impersonatePendingId === r.employeeId
                    ? "Opening..."
                    : "Dashboard Access"}
                </button>
              </DropdownMenuItem>
              {canUpdate && r.userId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      className="flex w-full items-center text-violet-600 focus:text-violet-600"
                      onClick={() => handleManagePermissionsClick(r)}
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Manage Permissions
                    </button>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <button
                      type="button"
                      className="flex w-full items-center text-amber-600 focus:text-amber-600"
                      onClick={() => handleResetPasswordClick(r)}
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Reset Password
                    </button>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const erpMasterModules = [
    "master.brand", "master.division", "master.channel-class", "master.color",
    "master.gender", "master.size", "master.silhouette", "master.tax-rate",
    "master.item-class", "master.item-subclass", "master.old-season", "master.season",
    "master.segment", "master.hs-code", "master.category", "master.sub-category", "master.uom"
  ];

  const posMasterModules = [
    "master.promo", "master.coupon", "master.alliance"
  ];

  const getCategory = (module: string): "HR" | "Master" | "ERP" | "POS" => {
    if (module.startsWith("pos.")) return "POS";

    if (erpMasterModules.includes(module) || posMasterModules.includes(module) || module.startsWith("master.") ||
      ["country", "state", "city", "location", "bank", "equipment",
        "allowance-head", "deduction-head", "salary-breakup", "tax-slab",
        "bonus-type", "loan-type", "leave-type", "leaves-policy", "eobi", "provident-fund",
        "approval-setting", "rebate-nature", "role"].includes(module)) {
      return "Master";
    }

    if (module.startsWith("erp.")) return "ERP";

    return "HR";
  };

  const getMasterSubCategory = (module: string): "HR" | "ERP" | "POS" => {
    if (posMasterModules.includes(module) || module === 'master.pos') return 'POS';
    if (erpMasterModules.includes(module)) return 'ERP';
    return 'HR';
  };

  const selectedUserRole = roles.find(r => r.id === permissionsTargetRow?.roleId);
  const rolePermissionIds = new Set(selectedUserRole?.permissions?.map(p => p.permission.id) || []);

  const groupedPermissions = allPermissions
    .filter((p) => {
      // Filter by active tab
      const cat = getCategory(p.module);
      if (cat !== activePermissionTab) return false;

      // Master tab filter
      if (activePermissionTab === "Master" && masterFilter !== "All") {
        if (getMasterSubCategory(p.module) !== masterFilter) return false;
      }

      // Filter by search
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(search) ||
        (p.description || "").toLowerCase().includes(search) ||
        p.module.toLowerCase().includes(search)
      );
    })
    .reduce((acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    }, {} as Record<string, any[]>);

  const groupedEntries = Object.entries(groupedPermissions) as [string, any[]][];

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={visibleRows}
        searchFields={[
          { key: "email", label: "Email" },
          { key: "employeeName", label: "Name" },
        ]}
        toggleAction={
          canCreate
            ? () => router.push("/hr/employee/user-account/create")
            : undefined
        }
        actionText="Create User Account"
        title="User Accounts"
        onMultiDelete={undefined}
      />

      <div className="mt-4 text-xs text-muted-foreground">
        Current Role: {userRole || "None"} | Admin Access:{" "}
        {isAdminRole ? "Yes" : "No"}
      </div>

      {/* Step 1: Manager verification */}
      <ManagerVerificationDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        onVerified={handleVerified}
        title="Manager Verification Required"
        description={`Verify your identity before resetting the password for ${resetTargetRow?.employeeName || "this employee"}.`}
      />

      {/* Step 2: New password form */}
      <Dialog
        open={resetDialogOpen}
        onOpenChange={(o) => {
          if (!isResetting) {
            setResetDialogOpen(o);
            if (!o) {
              setNewPassword("");
              setConfirmPassword("");
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-100">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-full bg-amber-500/10">
                <KeyRound className="h-5 w-5 text-amber-600" />
              </div>
              <DialogTitle>Reset Password</DialogTitle>
            </div>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-medium">{resetTargetRow?.employeeName}</span>.
              They will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isResetting}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isResetting}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmReset()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReset}
              disabled={isResetting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Managing Permissions & Role Expiry */}
      <Dialog
        open={permissionsDialogOpen}
        onOpenChange={(o) => {
          if (!isSavingPermissions) {
            setPermissionsDialogOpen(o);
          }
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-t-4 border-t-violet-600 bg-background/95 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-border/60 p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 shadow-inner">
                <ShieldCheck className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  Direct Permissions & Expiry
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Override permissions for <span className="font-semibold text-foreground">{permissionsTargetRow?.employeeName}</span> or configure temporary roles.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 p-6">
            {/* Role Expiration Configuration */}
            <div className="rounded-xl border border-border/80 bg-muted/10 p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-violet-500" />
                  Role Assignment
                </h4>
                {targetUserRoleExpiresAt && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getRelativeTimeDesc(targetUserRoleExpiresAt) === 'already expired'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-amber-500/10 text-amber-600'
                    }`}>
                    {getRelativeTimeDesc(targetUserRoleExpiresAt) === 'already expired' ? 'Expired' : `Expires ${getRelativeTimeDesc(targetUserRoleExpiresAt)}`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">Assigned Role</span>
                  <div className="text-sm font-semibold flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-600 text-xs border border-violet-500/20">
                      {roles.find(r => r.id === permissionsTargetRow?.roleId)?.name || "No Role"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-expiry" className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                    Expiry Date & Time (Optional)
                  </Label>
                  <input
                    id="role-expiry"
                    type="datetime-local"
                    className="flex h-9 w-full rounded-lg border border-input/60 bg-background/50 hover:bg-background/80 px-3 py-1 text-xs shadow-sm transition-all focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                    value={targetUserRoleExpiresAt}
                    onChange={(e) => setTargetUserRoleExpiresAt(e.target.value)}
                    disabled={isSavingPermissions || !permissionsTargetRow?.roleId}
                  />
                </div>
              </div>
            </div>

            {/* Permission Overrides */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-violet-500" />
                  Permission Overrides
                </h4>
                <div className="relative w-full sm:w-60 shrink-0">
                  <Search className="absolute left-2.5 top-2 text-muted-foreground h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    className="flex h-8 w-full rounded-lg border border-input/60 bg-background pl-8 pr-3 py-1 text-xs shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Categorization Tabs matching Role creation */}
              <Tabs
                value={activePermissionTab}
                onValueChange={(val) => {
                  setActivePermissionTab(val as any);
                  setSearchTerm("");
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4 bg-muted/30">
                  <TabsTrigger value="HR" className="text-xs">HR</TabsTrigger>
                  <TabsTrigger value="Master" className="text-xs">Master</TabsTrigger>
                  <TabsTrigger value="ERP" className="text-xs">ERP</TabsTrigger>
                  <TabsTrigger value="POS" className="text-xs">POS</TabsTrigger>
                </TabsList>

                {activePermissionTab === "Master" && (
                  <Tabs
                    value={masterFilter}
                    onValueChange={(val) => {
                      setMasterFilter(val as any);
                      setSearchTerm("");
                    }}
                    className="w-full mt-2"
                  >
                    <TabsList className="bg-muted/10 w-full grid grid-cols-4 h-8 p-0.5">
                      <TabsTrigger value="All" className="text-[11px] py-1">All Master</TabsTrigger>
                      <TabsTrigger value="HR" className="text-[11px] py-1">HR Master</TabsTrigger>
                      <TabsTrigger value="ERP" className="text-[11px] py-1">ERP Master</TabsTrigger>
                      <TabsTrigger value="POS" className="text-[11px] py-1">POS Master</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </Tabs>

              <div className="border border-border/80 rounded-xl divide-y divide-border/40 max-h-[350px] overflow-y-auto bg-card shadow-inner space-y-3 p-1">
                {groupedEntries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <Shield className="h-8 w-8 text-muted-foreground/40" />
                    No permissions found in this category.
                  </div>
                ) : (
                  groupedEntries.map(([moduleName, perms]) => (
                    <div key={moduleName} className="p-3 bg-muted/5 rounded-xl border border-border/50 space-y-2.5">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 border-b border-border/30 pb-1">
                        <FolderOpen className="h-3.5 w-3.5 text-violet-500/80" />
                        {moduleName}
                      </h5>
                      <div className="space-y-3">
                        {perms.map((perm) => {
                          const override = overrides[perm.id];
                          const isOverridden = override !== undefined;
                          const isAllowed = override?.isAllowed;
                          const isInherited = rolePermissionIds.has(perm.id);

                          // Get current value
                          let val = "default";
                          if (isOverridden) {
                            val = isAllowed ? "allow" : "deny";
                          }

                          const displayName = perm.name.startsWith(perm.module + '.')
                            ? perm.name.slice(perm.module.length + 1)
                            : perm.name;

                          return (
                            <div key={perm.id} className="text-xs group min-w-0 w-full p-2.5 rounded-lg hover:bg-muted/30 transition-all duration-150 space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 w-full">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-foreground truncate max-w-full">
                                      {displayName}
                                    </span>

                                    {/* Inheritance Status Badge */}
                                    {isInherited ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 bg-emerald-50/60 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200/40">
                                        <ShieldCheck className="h-2.5 w-2.5" />
                                        Inherited: Allow
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/50">
                                        <Shield className="h-2.5 w-2.5" />
                                        Inherited: Deny
                                      </span>
                                    )}
                                  </div>
                                  {perm.description && (
                                    <p className="text-[11px] text-muted-foreground leading-normal pr-2">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>

                                {/* Segmented Control Toggles */}
                                <div className="flex items-center p-0.5 bg-muted rounded-lg border border-border/40 shrink-0 self-end sm:self-center shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newOverrides = { ...overrides };
                                      delete newOverrides[perm.id];
                                      setOverrides(newOverrides);
                                    }}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${val === "default"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "bg-transparent text-muted-foreground/70 hover:text-foreground"
                                      }`}
                                  >
                                    Default
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOverrides({
                                        ...overrides,
                                        [perm.id]: {
                                          isAllowed: true,
                                          expiresAt: override?.expiresAt || ""
                                        }
                                      });
                                    }}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 flex items-center gap-1 ${val === "allow"
                                        ? "bg-emerald-500 text-white shadow-sm font-semibold"
                                        : "bg-transparent text-muted-foreground/70 hover:text-emerald-500"
                                      }`}
                                  >
                                    <ShieldCheck className="h-3 w-3" />
                                    Allow
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOverrides({
                                        ...overrides,
                                        [perm.id]: {
                                          isAllowed: false,
                                          expiresAt: override?.expiresAt || ""
                                        }
                                      });
                                    }}
                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 flex items-center gap-1 ${val === "deny"
                                        ? "bg-destructive text-white shadow-sm font-semibold"
                                        : "bg-transparent text-muted-foreground/70 hover:text-destructive"
                                      }`}
                                  >
                                    <ShieldX className="h-3 w-3" />
                                    Deny
                                  </button>
                                </div>
                              </div>

                              {/* Optional expiration for overrides */}
                              {isOverridden && (
                                <div className="flex flex-wrap items-center gap-2 pl-2 border-l-2 border-violet-500/40 py-1 mt-1 bg-muted/20 rounded px-2">
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Calendar className="h-3 w-3 text-violet-500/80" />
                                    <span>Expiry (Optional):</span>
                                  </div>
                                  <input
                                    id={`exp-${perm.id}`}
                                    type="datetime-local"
                                    className="h-6 rounded-md border border-input/60 bg-background/50 hover:bg-background px-2 py-0.5 text-[10px] shadow-sm transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50 cursor-pointer"
                                    value={override.expiresAt}
                                    onChange={(e) => {
                                      setOverrides({
                                        ...overrides,
                                        [perm.id]: {
                                          ...override,
                                          expiresAt: e.target.value
                                        }
                                      });
                                    }}
                                  />
                                  {override.expiresAt && (
                                    <span className={`text-[9px] font-semibold ml-auto px-1.5 py-0.5 rounded ${getRelativeTimeDesc(override.expiresAt) === 'already expired'
                                        ? 'bg-destructive/15 text-destructive'
                                        : 'bg-violet-500/15 text-violet-600'
                                      }`}>
                                      {getRelativeTimeDesc(override.expiresAt) === 'already expired' ? 'Expired' : `Expires ${getRelativeTimeDesc(override.expiresAt)}`}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/10 p-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setPermissionsDialogOpen(false)}
              disabled={isSavingPermissions}
              className="h-9 px-4 rounded-lg text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePermissions}
              disabled={isSavingPermissions}
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-md hover:shadow-lg transition-all duration-200 h-9 px-4 rounded-lg text-xs"
            >
              {isSavingPermissions && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Save Overrides
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
