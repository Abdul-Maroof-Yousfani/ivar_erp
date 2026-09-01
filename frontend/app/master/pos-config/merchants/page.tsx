"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Plus, Pencil, Trash2, Search, Building2, RefreshCw, X, Upload, Download,
} from "lucide-react";
import { authFetch } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { queueMerchantsExport } from "@/lib/actions/pos-config";
import { MerchantBulkUploadModal } from "@/components/master/merchant-bulk-upload-modal";
import { ChartOfAccountSelect } from "@/components/ui/chart-of-account-select";
import { getChartOfAccountsTree } from "@/lib/actions/chart-of-account";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Location { id: string; name: string; code: string; }
interface MerchantConfig {
  id: string;
  description: string;
  costCentreTag: string;
  tagId: string;
  bankName: string;
  merchantCode: number;
  commissionRate: string | number;
  bankGlCode: string;
  isActive: boolean;
  createdAt: string;
  locations: { id: string; locationId: string; location: Location }[];
}

const BANK_OPTIONS = [
  "HBL", "AL-Falah", "Keenu", "AL-Falah | AMEX", "Allied Bank",
  "Meezan", "HBL IPG", "AL-Falah IPG",
];

const MERCHANT_CODE_LABELS: Record<number, string> = {
  1: "1 – HBL",
  2: "2 – AL-Falah",
  3: "3 – Keenu",
  4: "4 – AMEX",
  5: "5 – Allied Bank",
  6: "6 – Meezan",
  7: "7 – HBL IPG",
  8: "8 – BAFL IPG",
};

const BANK_TO_MERCHANT_CODE: Record<string, number> = {
  "HBL": 1,
  "AL-Falah": 2,
  "Keenu": 3,
  "AL-Falah | AMEX": 4,
  "Allied Bank": 5,
  "Meezan": 6,
  "HBL IPG": 7,
  "AL-Falah IPG": 8,
};

// ─── Form defaults ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  description: "",
  costCentreTag: "",
  tagId: "",
  bankName: "",
  merchantCode: 1,
  commissionRate: "",
  bankGlCode: "",
  isActive: true,
  locationIds: [] as string[],
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantConfig[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterBank, setFilterBank] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Chart of accounts states
  const [accountsTree, setAccountsTree] = useState<any[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadMerchants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch("/pos-config/merchants");
      if (res.ok && res.data?.status) setMerchants(res.data.data || []);
      else toast.error(res.data?.message || "Failed to load merchants");
    } catch { toast.error("Failed to load merchants"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    loadMerchants();
    
    // Correct location API path
    authFetch("/locations")
      .then(res => { if (res.ok && res.data?.status) setLocations(res.data.data || []); })
      .catch(() => {});

    // Load Chart of Accounts Tree
    getChartOfAccountsTree()
      .then(res => {
        if (res.status && res.data) {
          setAccountsTree(res.data);
          const flat: any[] = [];
          const walk = (list: any[]) => {
            for (const node of list) {
              flat.push(node);
              if (node.children?.length) walk(node.children);
            }
          };
          walk(res.data);
          setFlatAccounts(flat);
        }
      })
      .catch(() => {});
  }, [loadMerchants]);

  // Sync selectedAccountId when flatAccounts or form.bankGlCode changes
  useEffect(() => {
    if (flatAccounts.length > 0 && form.bankGlCode) {
      const acc = flatAccounts.find(a => a.code === form.bankGlCode);
      if (acc && acc.id !== selectedAccountId) {
        setSelectedAccountId(acc.id);
      }
    } else if (!form.bankGlCode) {
      setSelectedAccountId("");
    }
  }, [flatAccounts, form.bankGlCode, selectedAccountId]);

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = merchants.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.description.toLowerCase().includes(q) ||
      m.costCentreTag.toLowerCase().includes(q) ||
      m.tagId.toLowerCase().includes(q) ||
      m.bankName.toLowerCase().includes(q) ||
      m.bankGlCode.includes(q);
    const matchBank = filterBank === "all" || m.bankName === filterBank;
    const matchActive = filterActive === "all" ||
      (filterActive === "active" ? m.isActive : !m.isActive);
    return matchSearch && matchBank && matchActive;
  });

  // ── Open create dialog ───────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setSelectedAccountId("");
    setDialogOpen(true);
  };

  // ── Open edit dialog ─────────────────────────────────────────────────────────
  const openEdit = (m: MerchantConfig) => {
    setEditingId(m.id);
    setForm({
      description: m.description,
      costCentreTag: m.costCentreTag,
      tagId: m.tagId,
      bankName: m.bankName,
      merchantCode: m.merchantCode,
      commissionRate: String(m.commissionRate),
      bankGlCode: m.bankGlCode,
      isActive: m.isActive,
      locationIds: m.locations.map(l => l.locationId),
    });
    const acc = flatAccounts.find(a => a.code === m.bankGlCode);
    setSelectedAccountId(acc?.id || "");
    setDialogOpen(true);
  };

  // ── Account Selector Change ──────────────────────────────────────────────────
  const handleAccountChange = (val: string) => {
    setSelectedAccountId(val);
    const acc = flatAccounts.find(a => a.id === val);
    if (acc) {
      setForm(f => ({ ...f, bankGlCode: acc.code }));
    } else {
      setForm(f => ({ ...f, bankGlCode: "" }));
    }
  };

  // ── Auto-fill description ────────────────────────────────────────────────────
  const autoDescription = () => {
    if (form.costCentreTag && form.bankName) {
      setForm(f => ({ ...f, description: `${f.costCentreTag} | ${f.bankName}` }));
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (form.locationIds.length === 0) { toast.error("Location is required"); return; }
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    if (!form.costCentreTag.trim()) { toast.error("Cost Centre Tag is required"); return; }
    if (!form.tagId.trim()) { toast.error("Tag ID is required"); return; }
    if (!form.bankName) { toast.error("Bank name is required"); return; }
    if (!form.commissionRate || isNaN(Number(form.commissionRate))) {
      toast.error("Valid commission rate is required"); return;
    }
    if (!form.bankGlCode.trim()) { toast.error("Bank GL Code is required"); return; }

    setIsSaving(true);
    try {
      const body = {
        ...form,
        commissionRate: Number(form.commissionRate),
        merchantCode: Number(form.merchantCode),
      };
      const res = editingId
        ? await authFetch(`/pos-config/merchants/${editingId}`, { method: "PUT", body })
        : await authFetch("/pos-config/merchants", { method: "POST", body });

      if (res.ok && res.data?.status) {
        toast.success(editingId ? "Merchant updated" : "Merchant created");
        setDialogOpen(false);
        loadMerchants();
      } else {
        toast.error(res.data?.message || "Save failed");
      }
    } catch { toast.error("Save failed"); }
    finally { setIsSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await authFetch(`/pos-config/merchants/${deleteId}`, { method: "DELETE" });
      if (res.ok && res.data?.status) {
        toast.success("Merchant deleted");
        setDeleteId(null);
        loadMerchants();
      } else {
        toast.error(res.data?.message || "Delete failed");
      }
    } catch { toast.error("Delete failed"); }
    finally { setIsDeleting(false); }
  };

  // ── Toggle location ──────────────────────────────────────────────────────────
  const toggleLocation = (locId: string) => {
    setForm(f => ({
      ...f,
      locationIds: f.locationIds.includes(locId)
        ? f.locationIds.filter(id => id !== locId)
        : [...f.locationIds, locId],
    }));
  };

  // ── Handle Export ────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await queueMerchantsExport({
        search: search || undefined,
        bankName: filterBank === "all" ? undefined : filterBank,
        isActive: filterActive === "all" ? undefined : filterActive === "active",
      });
      if (res.status) {
        toast.success(res.message || "Export started in background. You will be notified when download is ready.");
      } else {
        toast.error(res.message || "Failed to queue export job.");
      }
    } catch {
      toast.error("Failed to queue export job.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Unique banks for filter ──────────────────────────────────────────────────
  const uniqueBanks = [...new Set(merchants.map(m => m.bankName))].sort();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            Merchant / Bank Commission Config
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-location bank acquirer commission rates for card payment processing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadModalOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Bulk Import
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export Excel
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Merchant
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by tag, bank, GL code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={filterBank} onValueChange={setFilterBank}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Banks" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Banks</SelectItem>
            {uniqueBanks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadMerchants} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {merchants.length} records
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Description</TableHead>
              <TableHead>Tag ID</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="text-right">Code</TableHead>
              <TableHead className="text-right">Rate %</TableHead>
              <TableHead>GL Code</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No merchant configs found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(m => (
                <TableRow key={m.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{m.description}</p>
                      <p className="text-xs text-muted-foreground">{m.costCentreTag}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{m.tagId}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{m.bankName}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{m.merchantCode}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                    {(Number(m.commissionRate) * 100).toFixed(4)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">{m.bankGlCode}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {m.locations.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">All locations</span>
                      ) : m.locations.slice(0, 2).map(l => (
                        <Badge key={l.id} variant="outline" className="text-[10px] px-1">
                          {l.location.code}
                        </Badge>
                      ))}
                      {m.locations.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1">
                          +{m.locations.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? "default" : "secondary"} className="text-xs">
                      {m.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Merchant Config" : "Add Merchant Config"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Location selector */}
            <div className="space-y-1.5">
              <Label>Location <span className="text-destructive">*</span></Label>
              <Select
                value={form.locationIds[0] || ""}
                onValueChange={(val) => {
                  const loc = locations.find(l => l.id === val);
                  if (loc) {
                    setForm(f => {
                      const nextForm = {
                        ...f,
                        locationIds: [loc.id],
                        costCentreTag: loc.name,
                        tagId: loc.code,
                      };
                      if (f.bankName) {
                        nextForm.description = `${loc.name} | ${f.bankName}`;
                      }
                      return nextForm;
                    });
                  } else {
                    setForm(f => ({ ...f, locationIds: [], costCentreTag: "", tagId: "" }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select connected location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.code} – {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Derived Location Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cost Centre Tag</Label>
                <Input
                  disabled
                  placeholder="Derived from location..."
                  value={form.costCentreTag}
                  className="bg-muted/50 cursor-not-allowed text-muted-foreground font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tag ID</Label>
                <Input
                  disabled
                  placeholder="Derived from location..."
                  value={form.tagId}
                  className="bg-muted/50 cursor-not-allowed text-muted-foreground font-mono font-medium"
                />
              </div>
            </div>

            {/* Row 2: Bank + Merchant Code */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Bank / Acquirer <span className="text-destructive">*</span></Label>
                <Select
                  value={form.bankName}
                  onValueChange={v => {
                    const code = BANK_TO_MERCHANT_CODE[v] || 1;
                    setForm(f => {
                      const nextForm = {
                        ...f,
                        bankName: v,
                        merchantCode: code,
                      };
                      if (f.costCentreTag) {
                        nextForm.description = `${f.costCentreTag} | ${v}`;
                      }
                      return nextForm;
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Merchant Code</Label>
                <Input
                  disabled
                  placeholder="Derived from bank..."
                  value={MERCHANT_CODE_LABELS[form.merchantCode] || String(form.merchantCode)}
                  className="bg-muted/50 cursor-not-allowed text-muted-foreground font-medium"
                />
              </div>
            </div>

            {/* Row 3: Commission Rate + GL Code */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Commission Rate (decimal) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.000001"
                    min={0}
                    max={1}
                    placeholder="e.g. 0.01265"
                    value={form.commissionRate}
                    onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
                    className="pr-16 font-medium"
                  />
                  {form.commissionRate && !isNaN(Number(form.commissionRate)) && (
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                      = {(Number(form.commissionRate) * 100).toFixed(4)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bank GL Code <span className="text-destructive">*</span></Label>
                <ChartOfAccountSelect
                  accounts={accountsTree}
                  value={selectedAccountId}
                  onValueChange={handleAccountChange}
                  placeholder="Select Bank GL Account"
                  className="h-10 border-gray-300 dark:border-input"
                />
                {form.bankGlCode && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Selected GL Code: {form.bankGlCode}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Description <span className="text-destructive">*</span></Label>
                <button
                  type="button"
                  onClick={autoDescription}
                  className="text-xs text-primary hover:underline"
                >
                  Auto-fill
                </button>
              </div>
              <Input
                placeholder="e.g. C&K-CENTAURUS MALL | HBL"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="font-medium"
              />
            </div>

            <Separator />

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive configs won't appear at POS checkout</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Merchant Config?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this merchant commission config. Orders already linked to it will retain the reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MerchantBulkUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onSuccess={loadMerchants}
        uploadId={uploadId}
        onUploadIdChange={setUploadId}
      />
    </div>
  );
}
