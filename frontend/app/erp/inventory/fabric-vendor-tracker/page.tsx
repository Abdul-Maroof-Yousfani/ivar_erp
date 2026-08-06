"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fabricVendorTrackerApi, FabricVendorTracker } from "@/lib/api";
import { FabricVendorForm } from "@/components/inventory/fabric-vendor-form";
import { toast } from "sonner";
import {
  Plus,
  Search,
  RefreshCw,
  Scale,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  Package,
  Printer,
  Download,
} from "lucide-react";
import { PermissionGuard } from "@/components/auth/permission-guard";

export default function FabricVendorTrackerPage() {
  const [trackers, setTrackers] = useState<FabricVendorTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState<FabricVendorTracker | null>(null);

  // Delete Confirmation state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadTrackers();
  }, [statusFilter]);

  const loadTrackers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (search) {
        params.search = search;
      }
      const data = await fabricVendorTrackerApi.getAll(params);
      setTrackers(data || []);
    } catch (error) {
      console.error("Failed to load fabric trackers:", error);
      toast.error("Failed to fetch fabric vendor tracking records");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      loadTrackers();
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedTracker(null);
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (tracker: FabricVendorTracker) => {
    setSelectedTracker(tracker);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedTracker(null);
    loadTrackers();
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fabricVendorTrackerApi.delete(deleteId);
      toast.success("Fabric tracker record deleted and stock adjustments reverted successfully!");
      setDeleteId(null);
      loadTrackers();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to delete fabric tracker record");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params: any = {};
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (search) {
        params.search = search;
      }
      const res = await fabricVendorTrackerApi.queueExport(params);
      if (res.status) {
        toast.success(res.message || "Export job queued successfully! You will receive a notification when it is ready.");
      } else {
        toast.error(res.message || "Failed to queue export job");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to start export");
    } finally {
      setIsExporting(false);
    }
  };

  // Compute KPI summary stats
  const totalIssuesCount = trackers.length;
  const pendingOrPartialCount = trackers.filter((t) => t.status !== "COMPLETED").length;
  const completedCount = trackers.filter((t) => t.status === "COMPLETED").length;
  const totalIssuedQty = trackers.reduce((sum, t) => sum + Number(t.qtyIssued), 0);
  const totalReturnedQty = trackers.reduce((sum, t) => sum + Number(t.qtyReturned), 0);
  const totalUsedQty = trackers.reduce((sum, t) => sum + Number(t.qtyUsed), 0);

  return (
    <PermissionGuard permissions="erp.inventory.view">
      <div className="flex-1 space-y-6 p-8 pt-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 to-indigo-800 bg-clip-text text-transparent">
              Fabric Vendor Tracker
            </h2>
            <p className="text-muted-foreground text-sm">
              Manage and track fabric issues to vendors, log utilization, returns, and shortages.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button onClick={loadTrackers} variant="outline" size="icon" className="shrink-0" title="Refresh Data">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full md:w-auto font-medium">
              <Download className={`h-4 w-4 mr-2 ${isExporting ? "animate-bounce" : ""}`} />
              {isExporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button onClick={handleOpenCreateModal} className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Issue Fabric
            </Button>
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fabric Issued</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{totalIssuedQty.toLocaleString()} m</div>
              <p className="text-xs text-muted-foreground">Across {totalIssuesCount} total issue logs</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending / Partial</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-amber-600">{pendingOrPartialCount} records</div>
              <p className="text-xs text-muted-foreground">Active with vendors</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fabric Returned</CardTitle>
              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-emerald-600">{totalReturnedQty.toLocaleString()} m</div>
              <p className="text-xs text-muted-foreground">Returned back to warehouse</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Fabric Consumed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-blue-600">{totalUsedQty.toLocaleString()} m</div>
              <p className="text-xs text-muted-foreground">Reported utilization</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Controls */}
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-1 flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Tracker Ref, Vendor, Fabric, or Notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  className="pl-9 h-10 w-full"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] h-10">
                  <SelectValue placeholder="Status Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending (Issued)</SelectItem>
                  <SelectItem value="PARTIAL">Partial Consumption</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadTrackers} variant="secondary" className="h-10 px-6 font-semibold shrink-0">
              Apply Filters
            </Button>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Tracker Ref</TableHead>
                  <TableHead className="font-semibold text-foreground">Vendor</TableHead>
                  <TableHead className="font-semibold text-foreground">Fabric Item</TableHead>
                  <TableHead className="font-semibold text-foreground">Warehouse</TableHead>
                  <TableHead className="font-semibold text-foreground">Issued Qty</TableHead>
                  <TableHead className="font-semibold text-foreground">Usage Details</TableHead>
                  <TableHead className="font-semibold text-foreground">Dates</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                        <span>Loading tracker records...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : trackers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Layers className="h-8 w-8 text-muted-foreground/60" />
                        <span className="text-base font-semibold">No records found</span>
                        <p className="text-xs">Try adjusting your filters or issue a new fabric batch.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  trackers.map((tracker) => {
                    const issued = Number(tracker.qtyIssued);
                    const used = Number(tracker.qtyUsed || 0);
                    const returned = Number(tracker.qtyReturned || 0);
                    const shortage = Number(tracker.qtyShortage || 0);
                    const accounted = used + returned + shortage;
                    const remaining = Math.max(0, issued - accounted);

                    return (
                      <TableRow key={tracker.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-bold font-mono text-indigo-700">{tracker.trackerNumber}</TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold text-foreground">{tracker.supplier?.name}</span>
                            <span className="block text-xs text-muted-foreground font-mono">{tracker.supplier?.code}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-semibold">{tracker.item?.sku}</span>
                            <span className="block text-xs text-muted-foreground truncate max-w-[180px]">
                              {tracker.item?.description || "No description"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium">{tracker.warehouse?.name}</span>
                            <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                              {tracker.warehouse?.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold font-mono text-indigo-600">
                          {issued.toLocaleString()} {tracker.item?.uom || "m"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-green-600 font-semibold">U: {used}m</span>
                              <span className="text-blue-600 font-semibold">R: {returned}m</span>
                              {shortage > 0 && <span className="text-red-500 font-semibold">S: {shortage}m</span>}
                            </div>
                            {tracker.status !== "COMPLETED" && (
                              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                                Remaining: {remaining.toFixed(2)}m
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex flex-col space-y-0.5">
                            <span className="flex items-center gap-1">
                              <span className="text-[10px] font-semibold uppercase text-slate-400 w-10">Issue:</span>
                              {new Date(tracker.issueDate).toLocaleDateString()}
                            </span>
                            {tracker.consumptionDate && (
                              <span className="flex items-center gap-1">
                                <span className="text-[10px] font-semibold uppercase text-slate-400 w-10">Usage:</span>
                                {new Date(tracker.consumptionDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`font-semibold px-2.5 py-1 ${
                              tracker.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"
                                : tracker.status === "PARTIAL"
                                ? "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            }`}
                            variant="outline"
                          >
                            {tracker.status === "PENDING"
                              ? "Pending"
                              : tracker.status === "PARTIAL"
                              ? "Partial"
                              : "Completed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {tracker.status !== "COMPLETED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-semibold"
                                onClick={() => handleOpenEditModal(tracker)}
                              >
                                Log Consumption
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteClick(tracker.id)}
                              title="Delete tracker and revert stock"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Unified Add/Edit Form Modal */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800">
                {selectedTracker ? "Update Vendor Fabric Consumption" : "Issue Fabric to Vendor"}
              </DialogTitle>
              <DialogDescription>
                {selectedTracker
                  ? "Enter the exact quantities of fabric used, returned, and shortage."
                  : "Issue fabric items to a specific supplier (vendor) from a source warehouse."}
              </DialogDescription>
            </DialogHeader>
            <FabricVendorForm
              initialData={selectedTracker}
              onSuccess={handleFormSuccess}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription className="space-y-2 pt-2">
                <p>Are you sure you want to delete this fabric vendor tracking record?</p>
                <p className="text-xs text-amber-600 font-medium bg-amber-50 p-2 border border-amber-200 rounded">
                  ⚠️ This action will automatically adjust the Stock Ledger to reverse the issue and return quantity movements!
                </p>
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, Delete & Revert Stock"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
