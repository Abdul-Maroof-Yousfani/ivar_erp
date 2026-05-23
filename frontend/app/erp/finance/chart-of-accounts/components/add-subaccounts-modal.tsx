"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  Check,
  Building,
  Users,
  MapPin,
  Sparkles,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  ChartOfAccount,
  getSuppliers,
  createBulkSubAccounts,
} from "@/lib/actions/chart-of-account";
import { getCustomers } from "@/lib/actions/customer";
import { getLocations } from "@/lib/actions/location";

interface AddSubAccountsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentAccount: ChartOfAccount | null;
  onSuccess: () => void;
}

export function AddSubAccountsModal({
  open,
  onOpenChange,
  parentAccount,
  onSuccess,
}: AddSubAccountsModalProps) {
  const router = useRouter();

  // Data states
  const [suppliers, setSuppliers] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [locations, setLocations] = React.useState<any[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Tab & search states
  const [activeTab, setActiveTab] = React.useState<"suppliers" | "customers" | "locations">("suppliers");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Selected item IDs
  const [selectedSuppliers, setSelectedSuppliers] = React.useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = React.useState<Set<string>>(new Set());
  const [selectedLocations, setSelectedLocations] = React.useState<Set<string>>(new Set());

  // Result summary
  const [resultSummary, setResultSummary] = React.useState<{
    success: boolean;
    createdCount: number;
    skippedCount: number;
    skipped: any[];
  } | null>(null);

  // Fetch data on open
  React.useEffect(() => {
    if (!open) {
      // Reset state on close
      setSuppliers([]);
      setCustomers([]);
      setLocations([]);
      setSelectedSuppliers(new Set());
      setSelectedCustomers(new Set());
      setSelectedLocations(new Set());
      setSearchQuery("");
      setResultSummary(null);
      return;
    }

    async function loadData() {
      setLoadingData(true);
      try {
        const [suppRes, custRes, locRes] = await Promise.all([
          getSuppliers(),
          getCustomers(),
          getLocations(),
        ]);

        if (suppRes.status && Array.isArray(suppRes.data)) {
          setSuppliers(suppRes.data);
        } else if (Array.isArray(suppRes)) {
          setSuppliers(suppRes);
        }

        if (Array.isArray(custRes)) {
          setCustomers(custRes);
        } else if (custRes?.status && Array.isArray(custRes.data)) {
          setCustomers(custRes.data);
        }

        if (locRes.status && Array.isArray(locRes.data)) {
          // Map locations to a common structure
          setLocations(locRes.data);
        } else if (Array.isArray(locRes)) {
          setLocations(locRes);
        }
      } catch (err) {
        console.error("Error loading quick add data", err);
        toast.error("Failed to load Suppliers, Customers, or Locations.");
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [open]);

  // Filtering list based on search query
  const filteredSuppliers = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(query) ||
        s.code?.toLowerCase().includes(query)
    );
  }, [suppliers, searchQuery]);

  const filteredCustomers = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(query) ||
        c.code?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const filteredLocations = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter(
      (l) =>
        l.name?.toLowerCase().includes(query) ||
        l.code?.toLowerCase().includes(query)
    );
  }, [locations, searchQuery]);

  // Handle individual selection toggles
  const handleToggleSelect = (id: string, type: "suppliers" | "customers" | "locations") => {
    if (type === "suppliers") {
      setSelectedSuppliers((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else if (type === "customers") {
      setSelectedCustomers((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else if (type === "locations") {
      setSelectedLocations((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  // Helper: check if all filtered items are selected
  const isAllFilteredSelected = () => {
    if (activeTab === "suppliers") {
      if (filteredSuppliers.length === 0) return false;
      return filteredSuppliers.every((item) => selectedSuppliers.has(item.id));
    } else if (activeTab === "customers") {
      if (filteredCustomers.length === 0) return false;
      return filteredCustomers.every((item) => selectedCustomers.has(item.id));
    } else {
      if (filteredLocations.length === 0) return false;
      return filteredLocations.every((item) => selectedLocations.has(item.id));
    }
  };

  // Toggle select-all for filtered items in the active tab
  const handleToggleSelectAll = () => {
    const allSelected = isAllFilteredSelected();
    if (activeTab === "suppliers") {
      setSelectedSuppliers((prev) => {
        const next = new Set(prev);
        filteredSuppliers.forEach((item) => {
          if (allSelected) next.delete(item.id);
          else next.add(item.id);
        });
        return next;
      });
    } else if (activeTab === "customers") {
      setSelectedCustomers((prev) => {
        const next = new Set(prev);
        filteredCustomers.forEach((item) => {
          if (allSelected) next.delete(item.id);
          else next.add(item.id);
        });
        return next;
      });
    } else if (activeTab === "locations") {
      setSelectedLocations((prev) => {
        const next = new Set(prev);
        filteredLocations.forEach((item) => {
          if (allSelected) next.delete(item.id);
          else next.add(item.id);
        });
        return next;
      });
    }
  };

  // Sum of total selected items
  const totalSelected = selectedSuppliers.size + selectedCustomers.size + selectedLocations.size;

  // Handle Save
  const handleSave = async () => {
    if (!parentAccount) return;
    if (totalSelected === 0) {
      toast.warning("Please select at least one account to add.");
      return;
    }

    setSaving(true);
    try {
      const itemsToCreate: Array<{
        name: string;
        code: string;
        type: "SUPPLIER" | "CUSTOMER" | "LOCATION";
        referenceId: string;
      }> = [];

      // Collect Suppliers
      suppliers.forEach((s) => {
        if (selectedSuppliers.has(s.id)) {
          itemsToCreate.push({
            name: s.name,
            code: s.code || "",
            type: "SUPPLIER",
            referenceId: s.id,
          });
        }
      });

      // Collect Customers
      customers.forEach((c) => {
        if (selectedCustomers.has(c.id)) {
          itemsToCreate.push({
            name: c.name,
            code: c.code || "",
            type: "CUSTOMER",
            referenceId: c.id,
          });
        }
      });

      // Collect Locations
      locations.forEach((l) => {
        if (selectedLocations.has(l.id)) {
          itemsToCreate.push({
            name: l.name,
            code: l.code || "",
            type: "LOCATION",
            referenceId: l.id,
          });
        }
      });

      const res = await createBulkSubAccounts(parentAccount.id, itemsToCreate);

      if (res.status) {
        setResultSummary({
          success: true,
          createdCount: res.createdCount || 0,
          skippedCount: res.skippedCount || 0,
          skipped: res.skipped || [],
        });
        toast.success(res.message || "Sub-accounts quick-added successfully!");
        onSuccess();
        router.refresh();
      } else {
        toast.error(res.message || "Failed to create sub-accounts.");
      }
    } catch (err) {
      console.error("Failed to quick add sub-accounts:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-background border border-border shadow-2xl rounded-xl">
        <DialogHeader className="pb-2 border-b border-muted">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Quick Add Sub-accounts</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add Suppliers, Customers, or Locations as sub-accounts under{" "}
                <span className="font-mono font-semibold text-foreground px-1 py-0.5 rounded bg-muted">
                  {parentAccount?.code} — {parentAccount?.name}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {resultSummary ? (
          /* ─── Result Summary Screen ─── */
          <div className="flex-1 overflow-y-auto py-6 space-y-4">
            <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl border border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10 space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Check className="h-6 w-6 stroke-[3px]" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Sub-accounts Created Successfully!</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Added <strong className="text-foreground">{resultSummary.createdCount}</strong> sub-account(s) under the parent account hierarchy.
              </p>
            </div>

            {resultSummary.skippedCount > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-50/5 dark:bg-amber-950/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Skipped {resultSummary.skippedCount} accounts (code already exists)</span>
                </div>
                <div className="max-h-36 overflow-y-auto text-xs text-muted-foreground space-y-1 font-mono pr-2">
                  {resultSummary.skipped.map((skip, i) => (
                    <div key={i} className="flex justify-between p-1 bg-amber-500/5 rounded border border-amber-500/10">
                      <span>{skip.name}</span>
                      <span className="font-bold">{skip.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-muted">
              <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Close Modal
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ─── Standard Selection Screen ─── */
          <>
            {/* Search and Tabs */}
            <div className="py-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search active ${activeTab}...`}
                  className="pl-9 bg-muted/30 focus-visible:ring-primary/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(val: any) => {
                  setActiveTab(val);
                  setSearchQuery("");
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger value="suppliers" className="flex items-center gap-1.5 py-1.5">
                    <Building className="h-3.5 w-3.5" />
                    Suppliers ({selectedSuppliers.size})
                  </TabsTrigger>
                  <TabsTrigger value="customers" className="flex items-center gap-1.5 py-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Customers ({selectedCustomers.size})
                  </TabsTrigger>
                  <TabsTrigger value="locations" className="flex items-center gap-1.5 py-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Locations ({selectedLocations.size})
                  </TabsTrigger>
                </TabsList>

                {/* Tabs Content Wrapper */}
                <div className="mt-4 border rounded-lg bg-card/50 overflow-hidden">
                  {/* Select All Row */}
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground select-none">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all"
                        checked={isAllFilteredSelected()}
                        onCheckedChange={handleToggleSelectAll}
                      />
                      <label htmlFor="select-all" className="cursor-pointer">
                        Select All Filtered
                      </label>
                    </div>
                    <span>
                      {activeTab === "suppliers" && `${filteredSuppliers.length} suppliers`}
                      {activeTab === "customers" && `${filteredCustomers.length} customers`}
                      {activeTab === "locations" && `${filteredLocations.length} locations`}
                    </span>
                  </div>

                  {/* Scrollable list */}
                  <div className="h-64 overflow-y-auto divide-y pr-1">
                    {loadingData ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground font-medium">Fetching available records...</span>
                      </div>
                    ) : (
                      <>
                        <TabsContent value="suppliers" className="m-0 p-0">
                          {filteredSuppliers.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                              No suppliers found matching query.
                            </div>
                          ) : (
                            filteredSuppliers.map((sup) => (
                              <div
                                key={sup.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors select-none"
                              >
                                <Checkbox
                                  id={`sup-${sup.id}`}
                                  checked={selectedSuppliers.has(sup.id)}
                                  onCheckedChange={() => handleToggleSelect(sup.id, "suppliers")}
                                />
                                <label
                                  htmlFor={`sup-${sup.id}`}
                                  className="flex flex-1 items-center justify-between text-sm cursor-pointer"
                                >
                                  <span className="font-medium text-foreground">{sup.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                                    {sup.code || "No Code"}
                                  </span>
                                </label>
                              </div>
                            ))
                          )}
                        </TabsContent>

                        <TabsContent value="customers" className="m-0 p-0">
                          {filteredCustomers.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                              No customers found matching query.
                            </div>
                          ) : (
                            filteredCustomers.map((cust) => (
                              <div
                                key={cust.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors select-none"
                              >
                                <Checkbox
                                  id={`cust-${cust.id}`}
                                  checked={selectedCustomers.has(cust.id)}
                                  onCheckedChange={() => handleToggleSelect(cust.id, "customers")}
                                />
                                <label
                                  htmlFor={`cust-${cust.id}`}
                                  className="flex flex-1 items-center justify-between text-sm cursor-pointer"
                                >
                                  <span className="font-medium text-foreground">{cust.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                                    {cust.code || "No Code"}
                                  </span>
                                </label>
                              </div>
                            ))
                          )}
                        </TabsContent>

                        <TabsContent value="locations" className="m-0 p-0">
                          {filteredLocations.length === 0 ? (
                            <div className="py-12 text-center text-sm text-muted-foreground">
                              No locations found matching query.
                            </div>
                          ) : (
                            filteredLocations.map((loc) => (
                              <div
                                key={loc.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors select-none"
                              >
                                <Checkbox
                                  id={`loc-${loc.id}`}
                                  checked={selectedLocations.has(loc.id)}
                                  onCheckedChange={() => handleToggleSelect(loc.id, "locations")}
                                />
                                <label
                                  htmlFor={`loc-${loc.id}`}
                                  className="flex flex-1 items-center justify-between text-sm cursor-pointer"
                                >
                                  <span className="font-medium text-foreground">{loc.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                                    {loc.code || "No Code"}
                                  </span>
                                </label>
                              </div>
                            ))
                          )}
                        </TabsContent>
                      </>
                    )}
                  </div>
                </div>
              </Tabs>
            </div>

            {/* Footer buttons */}
            <DialogFooter className="pt-4 border-t border-muted gap-2 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-center justify-between w-full">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3 sm:mb-0">
                  <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                  <span>Selected <strong className="text-foreground">{totalSelected}</strong> items across all tabs</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving || totalSelected === 0} className="w-full sm:w-auto">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Add Sub-accounts
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
