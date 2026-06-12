"use client";

import * as React from "react";
import { ChartOfAccount, deleteChartOfAccount, queueChartOfAccountsExport } from "@/lib/actions/chart-of-account";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Folder, FileText, Upload, Loader2, Plus, MoreHorizontal, Pencil, Trash2, ShieldAlert, Download, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoaBulkUploadModal } from "@/components/finance/coa-bulk-upload-modal";
import { AddSubAccountsModal } from "./add-subaccounts-modal";
import { useUploadProgress } from "@/hooks/use-upload-progress";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import Link from "next/link";
import DataTable, { HighlightText } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { verifyPassword } from "@/lib/actions/users";

interface ChartOfAccountListProps {
  initialData: ChartOfAccount[];
}

const pkrFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
});

// Flatten the tree structure for DataTable with visibility tracking
function flattenTree(
  nodes: ChartOfAccount[], 
  depth = 0, 
  result: Array<ChartOfAccount & { depth: number; parentPath: string[] }> = [],
  parentPath: string[] = []
): Array<ChartOfAccount & { depth: number; parentPath: string[] }> {
  for (const node of nodes) {
    const currentPath = [...parentPath, node.id];
    result.push({ ...node, depth, parentPath });
    if (node.children?.length) {
      flattenTree(node.children, depth + 1, result, currentPath);
    }
  }
  return result;
}

// Build tree from flat list
function buildTree(flat: ChartOfAccount[]): ChartOfAccount[] {
  const map = new Map<string, ChartOfAccount>();
  const roots: ChartOfAccount[] = [];

  flat.forEach((item) => map.set(item.id, { ...item, children: [] }));

  flat.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

// Helper to find all ancestors of an account
function findAncestors(account: ChartOfAccount, allAccounts: ChartOfAccount[]): ChartOfAccount[] {
  const ancestors: ChartOfAccount[] = [];
  let current = account;
  let safetyCounter = 0;
  while (current.parentId && safetyCounter < 100) {
    const parent = allAccounts.find((a) => a.id === current.parentId);
    if (!parent) break;
    ancestors.push(parent);
    current = parent;
    safetyCounter++;
  }
  return ancestors;
}

// Generate tags for chart of accounts based on their place in the hierarchy
function getAccountTags(account: ChartOfAccount, allAccounts: ChartOfAccount[]): string[] {
  const tags: string[] = [];

  // Group vs Ledger
  if (account.isGroup) {
    tags.push("Group");
  } else {
    tags.push("Ledger");
  }

  const ancestors = findAncestors(account, allAccounts);
  const ancestorNames = ancestors.map((a) => a.name.toUpperCase());
  const ancestorCodes = ancestors.map((a) => a.code);
  const selfName = account.name.toUpperCase();
  const selfCode = account.code;

  if (account.isGroup) {
    // Classification for groups (Control Accounts)
    if (
      selfName.includes("DEBTOR") ||
      selfName.includes("RECEIVABLE") ||
      selfName.includes("CUSTOMER") ||
      selfName.includes("A/R PARTIES")
    ) {
      tags.push("Customer Control");
    } else if (
      selfName.includes("CREDITOR") ||
      selfName.includes("PAYABLE") ||
      selfName.includes("SUPPLIER") ||
      selfName.includes("A/P PARTIES") ||
      selfCode.startsWith("12030001")
    ) {
      tags.push("Supplier Control");
    } else if (
      selfName.includes("BANK") ||
      selfName.includes("CASH")
    ) {
      tags.push("Cash/Bank Control");
    } else if (
      selfName.includes("TAX") ||
      selfName.includes("DUTY")
    ) {
      tags.push("Tax Control");
    } else if (
      selfName.includes("EMPLOYEE") ||
      selfName.includes("SALARY") ||
      selfName.includes("STAFF")
    ) {
      tags.push("Employee Control");
    } else if (
      selfName.includes("LOCATION") ||
      selfName.includes("OUTLET") ||
      selfName.includes("STORE") ||
      selfName.includes("WAREHOUSE")
    ) {
      tags.push("Location Control");
    }
  } else {
    // Classification for ledger accounts
    const belongsTo = (namePattern: string, codePrefix?: string) => {
      return (
        ancestorNames.some((name) => name.includes(namePattern)) ||
        (codePrefix && ancestorCodes.some((code) => code.startsWith(codePrefix))) ||
        (codePrefix && selfCode.startsWith(codePrefix))
      );
    };

    if (
      belongsTo("DEBTOR") ||
      belongsTo("RECEIVABLE") ||
      belongsTo("CUSTOMER") ||
      belongsTo("A/R PARTIES") ||
      selfCode.startsWith("3102")
    ) {
      tags.push("Customer");
    } else if (
      belongsTo("CREDITOR") ||
      belongsTo("PAYABLE") ||
      belongsTo("SUPPLIER") ||
      belongsTo("A/P PARTIES") ||
      selfCode.startsWith("1201") ||
      selfCode.startsWith("12030001")
    ) {
      tags.push("Supplier");
    } else if (belongsTo("BANK") || selfCode.startsWith("3104") || selfCode.startsWith("3105")) {
      tags.push("Bank");
    } else if (belongsTo("CASH") || selfCode.startsWith("3106")) {
      tags.push("Cash");
    } else if (belongsTo("TAX") || belongsTo("DUTY") || selfCode.startsWith("1204") || selfCode.startsWith("1206")) {
      tags.push("Tax");
    } else if (
      belongsTo("EMPLOYEE") ||
      belongsTo("SALARY") ||
      belongsTo("STAFF") ||
      selfCode.startsWith("12030002") ||
      selfCode.startsWith("12030003") ||
      selfCode.startsWith("3103")
    ) {
      tags.push("Employee");
    } else if (belongsTo("LOCATION") || belongsTo("OUTLET") || belongsTo("STORE") || belongsTo("WAREHOUSE")) {
      tags.push("Location");
    }
  }

  return tags;
}

export function ChartOfAccountList({ initialData }: ChartOfAccountListProps) {
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();

  React.useEffect(() => {
    console.log("INITIAL DATA TOTAL:", initialData.length);
    const apParties = initialData.find(a => a.code === "12030001");
    if (apParties) {
      const children = initialData.filter(a => a.parentId === apParties.id);
      console.log("AP PARTIES FOUND:", apParties);
      console.log("AP PARTIES CHILDREN COUNT:", children.length);
      console.log("AP PARTIES CHILDREN:", children.map(c => `${c.code} - ${c.name}`));
    } else {
      console.log("AP PARTIES NOT FOUND IN INITIAL DATA!");
    }
  }, [initialData]);

  const canCreate = hasPermission("erp.finance.chart-of-account.create");
  const canEdit   = hasPermission("erp.finance.chart-of-account.update");
  const canDelete = hasPermission("erp.finance.chart-of-account.delete");
  const userIsAdmin = isAdmin();

  // Collapse/expand state
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(new Set());
  const [activeParentForSubAccounts, setActiveParentForSubAccounts] = React.useState<ChartOfAccount | null>(null);

  const toggleCollapse = React.useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Build tree and flatten for DataTable
  const tree = React.useMemo(() => buildTree(initialData), [initialData]);
  const allFlatData = React.useMemo(() => flattenTree(tree), [tree]);

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [preSearchCollapsedIds, setPreSearchCollapsedIds] = React.useState<Set<string> | null>(null);

  // Save/restore collapse state and auto-expand ancestors on search
  React.useEffect(() => {
    if (searchQuery.trim()) {
      // If we weren't searching before, save the current collapsed state
      if (preSearchCollapsedIds === null) {
        setPreSearchCollapsedIds(new Set(collapsedIds));
      }

      // Find all matches and their ancestors to expand them
      const query = searchQuery.toLowerCase().trim();
      const ancestorsToExpand = new Set<string>();

      allFlatData.forEach(item => {
        const tags = getAccountTags(item, initialData);
        const matches =
          item.name.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          tags.some(t => t.toLowerCase().includes(query));

        if (matches) {
          item.parentPath.forEach(parentId => {
            ancestorsToExpand.add(parentId);
          });
        }
      });

      // Update collapsedIds: remove any ancestor that we want to expand
      setCollapsedIds(prev => {
        const next = new Set(prev);
        ancestorsToExpand.forEach(id => {
          next.delete(id);
        });
        return next;
      });
    } else {
      // Search cleared: restore pre-search collapsed state
      if (preSearchCollapsedIds !== null) {
        setCollapsedIds(preSearchCollapsedIds);
        setPreSearchCollapsedIds(null);
      }
    }
  }, [searchQuery, allFlatData, initialData]);

  // Filter out collapsed children or filter by search query with parent preservation
  const flatData = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return allFlatData.filter(item => {
        // Check if any parent in the path is collapsed
        return !item.parentPath.some(parentId => collapsedIds.has(parentId));
      });
    }

    const query = searchQuery.toLowerCase().trim();

    // 1. Identify which node IDs match the query (including matching tags)
    const matchedIds = new Set<string>();
    allFlatData.forEach(item => {
      const tags = getAccountTags(item, initialData);
      if (
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        tags.some(t => t.toLowerCase().includes(query))
      ) {
        matchedIds.add(item.id);
      }
    });

    // 1.5 Include all descendant accounts of any matched node
    const finalMatchedIds = new Set<string>(matchedIds);
    allFlatData.forEach(item => {
      if (item.parentPath.some(parentId => matchedIds.has(parentId))) {
        finalMatchedIds.add(item.id);
      }
    });

    // 2. Identify all node IDs that should be visible (matches + their ancestors)
    const visibleIds = new Set<string>();
    allFlatData.forEach(item => {
      if (finalMatchedIds.has(item.id)) {
        visibleIds.add(item.id);
        item.parentPath.forEach(parentId => {
          visibleIds.add(parentId);
        });
      }
    });

    // 3. Keep only visible nodes AND respect the current collapse state
    return allFlatData.filter(item => {
      if (!visibleIds.has(item.id)) return false;
      return !item.parentPath.some(parentId => collapsedIds.has(parentId));
    });
  }, [allFlatData, collapsedIds, searchQuery, initialData]);

  // ── Delete dialog state ──────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = React.useState<ChartOfAccount | null>(null);
  const [deleteStep, setDeleteStep] = React.useState<"confirm" | "password">("confirm");
  const [adminPassword, setAdminPassword] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState("");

  const openDeleteDialog = React.useCallback((node: ChartOfAccount) => {
    setDeleteTarget(node);
    setDeleteStep("confirm");
    setAdminPassword("");
    setPasswordError("");
  }, []);

  const closeDeleteDialog = React.useCallback(() => {
    if (isDeleting) return;
    setDeleteTarget(null);
    setAdminPassword("");
    setPasswordError("");
  }, [isDeleting]);

  const handleDeleteProceed = React.useCallback(() => {
    setDeleteStep("password");
    setPasswordError("");
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget) return;
    if (!adminPassword.trim()) {
      setPasswordError("Password is required.");
      return;
    }

    setIsDeleting(true);
    setPasswordError("");

    try {
      const verify = await verifyPassword(adminPassword);
      if (!verify.status) {
        setPasswordError("Incorrect password. Only admins can delete accounts.");
        setIsDeleting(false);
        return;
      }

      const result = await deleteChartOfAccount(deleteTarget.id);
      if (result.status) {
        toast.success(result.message || "Account deleted successfully");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete account");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
      setAdminPassword("");
    }
  }, [deleteTarget, adminPassword, router]);

  const handleEditClick = React.useCallback((node: ChartOfAccount) => {
    router.push(`/erp/finance/chart-of-accounts/edit/${node.id}`);
  }, [router]);

  // ── Export state ─────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = React.useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const result = await queueChartOfAccountsExport();
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
  }, [isExporting]);

  // ── Bulk upload state ────────────────────────────────────────────────────
  const [isBulkUploadOpen, setIsBulkUploadOpen] = React.useState(false);
  const [activeUploadId, setActiveUploadId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const stored = localStorage.getItem("active_coa_upload_id");
    if (stored) setActiveUploadId(stored);
  }, []);

  const handleUploadIdChange = (id: string | null) => {
    setActiveUploadId(id);
    if (id) {
      localStorage.setItem("active_coa_upload_id", id);
    } else {
      localStorage.removeItem("active_coa_upload_id");
    }
  };

  const { data: uploadProgress } = useUploadProgress(activeUploadId, "coa");

  React.useEffect(() => {
    if (uploadProgress?.status === "completed") {
      router.refresh();
    }
  }, [uploadProgress?.status, router]);

  // ── DataTable columns ────────────────────────────────────────────────────
  const columns: ColumnDef<ChartOfAccount & { depth: number; parentPath: string[] }>[] = React.useMemo(() => [
    {
      accessorKey: "name",
      header: "Account Name",
      // Add accessorFn to make search work properly
      accessorFn: (row) => `${row.code} ${row.name}`,
      cell: ({ row }) => {
        const account = row.original;
        const indentSize = 24;
        const depth = account.depth || 0;
        const isCollapsed = collapsedIds.has(account.id);
        const hasChildren = account.children && account.children.length > 0;

        return (
          <div className="flex items-center" style={{ paddingLeft: `${depth * indentSize}px` }}>
            {/* Collapse/Expand chevron - show for all accounts */}
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(account.id);
                }}
                className="mr-1 p-0.5 hover:bg-accent rounded transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5 mr-1" /> // Spacer for alignment when no children
            )}

            {account.isGroup ? (
              <Folder className="mr-2 h-4 w-4 shrink-0 text-blue-500 fill-blue-500/20" />
            ) : (
              <FileText className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            )}
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground/70">
                <HighlightText text={account.code} />
              </span>
              <span
                className={cn(
                  "truncate",
                  account.isGroup
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <HighlightText text={account.name} />
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          <HighlightText text={row.getValue("code")} />
        </span>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row }) => {
        const account = row.original;
        const tags = getAccountTags(account, initialData);
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => {
              let badgeClass = "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400";
              if (tag === "Group") {
                badgeClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/30";
              } else if (tag === "Ledger") {
                badgeClass = "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800/30";
              } else if (tag.includes("Customer")) {
                badgeClass = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/30";
              } else if (tag.includes("Supplier")) {
                badgeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/30";
              } else if (tag.includes("Bank")) {
                badgeClass = "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/30";
              } else if (tag.includes("Cash")) {
                badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30";
              } else if (tag.includes("Tax")) {
                badgeClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/30";
              } else if (tag.includes("Employee")) {
                badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800/30";
              } else if (tag.includes("Location")) {
                badgeClass = "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-800/30";
              }
              return (
                <Badge key={tag} variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0.5", badgeClass)}>
                  {tag}
                </Badge>
              );
            })}
          </div>
        );
      }
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.getValue("type")}
        </Badge>
      ),
    },
    {
      accessorKey: "isGroup",
      header: "Group",
      cell: ({ row }) => (
        <Checkbox checked={row.getValue("isGroup")} disabled className="opacity-70" />
      ),
    },
    {
      accessorKey: "isActive",
      header: "Active",
      cell: ({ row }) => (
        <Badge
          variant={row.getValue("isActive") ? "default" : "secondary"}
          className="rounded-full"
        >
          {row.getValue("isActive") ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const account = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem onClick={() => handleEditClick(account)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canEdit && canCreate && (
                <DropdownMenuItem onClick={() => setActiveParentForSubAccounts(account)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Sub-accounts
                </DropdownMenuItem>
              )}
              {(canEdit || canCreate) && canDelete && <DropdownMenuSeparator />}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => openDeleteDialog(account)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [canEdit, canCreate, canDelete, handleEditClick, openDeleteDialog, collapsedIds, toggleCollapse, setActiveParentForSubAccounts]);

  // ── Upload progress button label ─────────────────────────────────────────
  const progressLabel = React.useMemo(() => {
    const s = uploadProgress?.status;
    if (s === "failed")     return "Import Failed";
    if (s === "completed")  return "Import Complete";
    if (s === "validated")  return "Validation Complete";
    if (s === "validating") return `Validating ${uploadProgress?.progress ?? 0}%`;
    return `Importing ${uploadProgress?.progress ?? 0}%`;
  }, [uploadProgress?.status, uploadProgress?.progress]);

  const isInProgress =
    uploadProgress?.status === "validating" ||
    uploadProgress?.status === "processing" ||
    uploadProgress?.status === "pending";

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your financial accounts hierarchy.</p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting || initialData.length === 0}
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isExporting ? "Queuing…" : "Export"}
            </Button>
            <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import
            </Button>
            <Link href="/erp/finance/chart-of-accounts/create" transitionTypes={["nav-forward"]}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Background progress pill */}
      {activeUploadId && !isBulkUploadOpen && (
        <Button
          variant={
            uploadProgress?.status === "failed"
              ? "destructive"
              : uploadProgress?.status === "completed"
              ? "default"
              : "outline"
          }
          className={cn(
            "relative overflow-hidden min-w-48 border-primary text-primary",
            uploadProgress?.status === "failed" &&
              "border-destructive! text-destructive-foreground! bg-destructive!",
            uploadProgress?.status === "completed" &&
              "text-primary-foreground! bg-primary!"
          )}
          onClick={() => setIsBulkUploadOpen(true)}
        >
          <div
            className="absolute inset-0 bg-primary/10 transition-all duration-500"
            style={{ width: `${uploadProgress?.progress ?? 0}%` }}
          />
          <div className="relative flex items-center gap-2">
            {isInProgress && <Loader2 className="h-4 w-4 animate-spin" />}
            <span className="font-bold">{progressLabel}</span>
          </div>
        </Button>
      )}

      {/* DataTable */}
      <DataTable
        data={flatData}
        columns={columns}
        searchFields={[
          { key: "name", label: "Name or Code" },
        ]}
        manualFiltering={true}
        onSearchChange={setSearchQuery}
        canBulkEdit={false}
        canBulkDelete={false}
        canRowEdit={false}
        canRowDelete={false}
        initialPageSize={1000}
      />

      {/* ── Bulk Upload Modal ── */}
      <CoaBulkUploadModal
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        onSuccess={() => router.refresh()}
        uploadId={activeUploadId}
        onUploadIdChange={handleUploadIdChange}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={closeDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          {deleteStep === "confirm" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-5 w-5" />
                  Delete Account
                </DialogTitle>
                <DialogDescription className="pt-1">
                  You are about to delete{" "}
                  <span className="font-semibold text-foreground">
                    {deleteTarget?.code} — {deleteTarget?.name}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2 text-sm">
                <p className="font-semibold text-destructive">This action will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Permanently delete this account and all its sub-accounts</li>
                  <li>Remove all associated journal entries and transactions</li>
                  <li>Clear all related financial records</li>
                </ul>
                <p className="text-destructive font-medium pt-1">This cannot be undone.</p>
              </div>

              {!userIsAdmin && (
                <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Only admins and super-admins can delete accounts. You will need to provide admin credentials.</span>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={closeDeleteDialog}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteProceed}>
                  Continue to Delete
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Admin Verification Required
                </DialogTitle>
                <DialogDescription className="pt-1">
                  Enter your admin password to confirm deletion of{" "}
                  <span className="font-semibold text-foreground">
                    {deleteTarget?.code} — {deleteTarget?.name}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Admin Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setPasswordError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isDeleting) handleDeleteConfirm();
                    }}
                    disabled={isDeleting}
                    autoFocus
                    autoComplete="current-password"
                  />
                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Only super-admin and admin accounts can authorize this deletion.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setDeleteStep("confirm")}
                  disabled={isDeleting}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting || !adminPassword.trim()}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Confirm Delete
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Sub-accounts Modal ── */}
      <AddSubAccountsModal
        open={!!activeParentForSubAccounts}
        onOpenChange={(open) => !open && setActiveParentForSubAccounts(null)}
        parentAccount={activeParentForSubAccounts}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
