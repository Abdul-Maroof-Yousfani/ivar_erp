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
  UserCheck,
  PackageOpen,
  Briefcase,
  Banknote,
  Receipt,
  Plus
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
import { getPayees, createPayee } from "@/lib/actions/payee";
import { getEmployees } from "@/lib/actions/employee";

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
  const [merchandise, setMerchandise] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [locations, setLocations] = React.useState<any[]>([]);
  const [directors, setDirectors] = React.useState<any[]>([]);
  const [salaries, setSalaries] = React.useState<any[]>([]);
  const [taxes, setTaxes] = React.useState<any[]>([]);
  const [employees, setEmployees] = React.useState<any[]>([]);

  const [loadingData, setLoadingData] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Form states for bulk creation
  const [bulkData, setBulkData] = React.useState("");
  const [creatingPayee, setCreatingPayee] = React.useState(false);

  // Tab & search states
  type TabType = "suppliers" | "customers" | "locations" | "directors" | "employees" | "merchandise" | "salaries" | "taxes";
  const [activeTab, setActiveTab] = React.useState<TabType>("suppliers");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Selected item IDs
  const [selected, setSelected] = React.useState<Record<TabType, Set<string>>>({
    suppliers: new Set(),
    customers: new Set(),
    locations: new Set(),
    directors: new Set(),
    employees: new Set(),
    merchandise: new Set(),
    salaries: new Set(),
    taxes: new Set(),
  });

  // Result summary
  const [resultSummary, setResultSummary] = React.useState<{
    success: boolean;
    createdCount: number;
    skippedCount: number;
    skipped: any[];
  } | null>(null);

  const loadPayeeData = async (type: 'director' | 'salary' | 'tax') => {
    const res = await getPayees(type);
    if (res.status && Array.isArray(res.data)) {
      if (type === 'director') setDirectors(res.data);
      if (type === 'salary') setSalaries(res.data);
      if (type === 'tax') setTaxes(res.data);
    }
  };

  React.useEffect(() => {
    if (!open) {
      setSuppliers([]);
      setMerchandise([]);
      setCustomers([]);
      setLocations([]);
      setDirectors([]);
      setSalaries([]);
      setTaxes([]);
      setEmployees([]);
      setSelected({
        suppliers: new Set(),
        customers: new Set(),
        locations: new Set(),
        directors: new Set(),
        employees: new Set(),
        merchandise: new Set(),
        salaries: new Set(),
        taxes: new Set(),
      });
      setSearchQuery("");
      setBulkData("");
      setResultSummary(null);
      return;
    }

    async function loadData() {
      setLoadingData(true);
      try {
        const [suppRes, custRes, locRes, empRes] = await Promise.all([
          getSuppliers(),
          getCustomers(),
          getLocations(),
          getEmployees(),
        ]);
        
        await Promise.all([
          loadPayeeData('director'),
          loadPayeeData('salary'),
          loadPayeeData('tax')
        ]);

        let allSuppliers = [];
        if (suppRes.status && Array.isArray(suppRes.data)) {
          allSuppliers = suppRes.data;
        } else if (Array.isArray(suppRes)) {
          allSuppliers = suppRes;
        }
        
        setSuppliers(allSuppliers.filter(s => s.type !== 'IMPORT'));
        setMerchandise(allSuppliers.filter(s => s.type === 'IMPORT'));

        if (Array.isArray(custRes)) {
          setCustomers(custRes);
        } else if (custRes?.status && Array.isArray(custRes.data)) {
          setCustomers(custRes.data);
        }

        if (locRes.status && Array.isArray(locRes.data)) {
          setLocations(locRes.data);
        } else if (Array.isArray(locRes)) {
          setLocations(locRes);
        }

        if (empRes.status && Array.isArray(empRes.data)) {
          setEmployees(empRes.data);
        } else if (Array.isArray(empRes)) {
          setEmployees(empRes as any);
        }
      } catch (err) {
        console.error("Error loading quick add data", err);
        toast.error("Failed to load records.");
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [open]);

  const getActiveArray = () => {
    switch (activeTab) {
      case "suppliers": return suppliers;
      case "customers": return customers;
      case "locations": return locations;
      case "directors": return directors;
      case "employees": return employees;
      case "merchandise": return merchandise;
      case "salaries": return salaries;
      case "taxes": return taxes;
      default: return [];
    }
  };

  const getFilteredItems = () => {
    const arr = getActiveArray();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return arr;
    return arr.filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.code?.toLowerCase().includes(query) || 
        item.employeeId?.toLowerCase().includes(query) ||
        item.employeeName?.toLowerCase().includes(query)
    );
  };

  const filteredItems = getFilteredItems();

  const handleToggleSelect = (id: string) => {
    setSelected((prev) => {
      const nextTabSet = new Set(prev[activeTab]);
      if (nextTabSet.has(id)) nextTabSet.delete(id);
      else nextTabSet.add(id);
      return { ...prev, [activeTab]: nextTabSet };
    });
  };

  const isAllFilteredSelected = () => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => selected[activeTab].has(item.id));
  };

  const handleToggleSelectAll = () => {
    const allSelected = isAllFilteredSelected();
    setSelected((prev) => {
      const nextTabSet = new Set(prev[activeTab]);
      filteredItems.forEach((item) => {
        if (allSelected) nextTabSet.delete(item.id);
        else nextTabSet.add(item.id);
      });
      return { ...prev, [activeTab]: nextTabSet };
    });
  };

  const handleCreatePayee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkData.trim()) {
      toast.error("Please enter data");
      return;
    }
    
    let payeeType: 'director' | 'salary' | 'tax' | null = null;
    if (activeTab === 'directors') payeeType = 'director';
    if (activeTab === 'salaries') payeeType = 'salary';
    if (activeTab === 'taxes') payeeType = 'tax';
    
    if (!payeeType) return;

    setCreatingPayee(true);
    try {
      const lines = bulkData.split('\n').map(l => l.trim()).filter(Boolean);
      let successCount = 0;
      let failCount = 0;

      for (const line of lines) {
        // Assume format: CODE   NAME (tab or space separated)
        const parts = line.split(/\t|\s{2,}/); // split by tab or multiple spaces
        let code = '';
        let name = '';
        if (parts.length >= 2) {
          code = parts[0].trim();
          name = parts.slice(1).join(' ').trim();
        } else {
          // fallback to simple split by space
          const sp = line.split(/\s+/);
          code = sp[0];
          name = sp.slice(1).join(' ') || code;
        }

        if (!code || !name) continue;

        const res = await createPayee(payeeType, { code, name });
        if (res.status) {
          successCount++;
        } else {
          failCount++;
        }
      }

      toast.success(`Created ${successCount} records.${failCount > 0 ? ` Failed ${failCount}.` : ''}`);
      setBulkData("");
      await loadPayeeData(payeeType);
    } catch (err) {
      toast.error("An error occurred during bulk create");
    } finally {
      setCreatingPayee(false);
    }
  };

  const totalSelected = Object.values(selected).reduce((acc, set) => acc + set.size, 0);

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
        type: "SUPPLIER" | "CUSTOMER" | "LOCATION" | "DIRECTOR" | "EMPLOYEE" | "MERCHANDISE" | "SALARY" | "TAX";
        referenceId: string;
      }> = [];

      const addItems = (typeMap: TabType, typeStr: any, itemCodeKey: string = 'code') => {
        let arr: any[] = [];
        if (typeMap === 'suppliers') arr = suppliers;
        if (typeMap === 'customers') arr = customers;
        if (typeMap === 'locations') arr = locations;
        if (typeMap === 'directors') arr = directors;
        if (typeMap === 'employees') arr = employees;
        if (typeMap === 'merchandise') arr = merchandise;
        if (typeMap === 'salaries') arr = salaries;
        if (typeMap === 'taxes') arr = taxes;
        
        arr.forEach((item) => {
          if (selected[typeMap].has(item.id)) {
            itemsToCreate.push({
              name: item.name || item.employeeName || "",
              code: item[itemCodeKey] || "",
              type: typeStr,
              referenceId: item.id,
            });
          }
        });
      };

      addItems('suppliers', 'SUPPLIER');
      addItems('customers', 'CUSTOMER');
      addItems('locations', 'LOCATION');
      addItems('directors', 'DIRECTOR');
      addItems('employees', 'EMPLOYEE', 'employeeId');
      addItems('merchandise', 'MERCHANDISE');
      addItems('salaries', 'SALARY');
      addItems('taxes', 'TAX');

      const res = await createBulkSubAccounts(parentAccount.id, itemsToCreate as any);

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

  const renderTabTrigger = (val: TabType, label: string, Icon: any) => (
    <TabsTrigger value={val} className="flex flex-col items-center gap-1 py-2 text-xs">
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.substring(0,3)}</span>
      <span className="text-[10px] opacity-70">({selected[val].size})</span>
    </TabsTrigger>
  );

  const canCreate = activeTab === 'directors' || activeTab === 'salaries' || activeTab === 'taxes';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh]">
        <DialogHeader className="pb-2 border-b border-muted">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Quick Add Sub-accounts</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add references as sub-accounts under{" "}
                <span className="font-mono font-semibold text-foreground px-1 py-0.5 rounded bg-muted">
                  {parentAccount?.code} — {parentAccount?.name}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {resultSummary ? (
          <div className="flex-1 overflow-y-auto py-6 space-y-4">
            <div className="flex flex-col items-center justify-center p-6 text-center rounded-xl border border-emerald-500/20 bg-emerald-50/10 space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Check className="h-6 w-6 stroke-[3px]" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Sub-accounts Created Successfully!</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Added <strong className="text-foreground">{resultSummary.createdCount}</strong> sub-account(s).
              </p>
            </div>

            {resultSummary.skippedCount > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-50/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
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
          <>
            <div className="py-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={"Search active tab..."}
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
                <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 bg-muted/50 p-1 rounded-lg h-auto">
                  {renderTabTrigger("suppliers", "Suppliers", Building)}
                  {renderTabTrigger("customers", "Customers", Users)}
                  {renderTabTrigger("locations", "Locations", MapPin)}
                  {renderTabTrigger("employees", "Employees", UserCheck)}
                  {renderTabTrigger("merchandise", "Merch", PackageOpen)}
                  {renderTabTrigger("directors", "Directors", Briefcase)}
                  {renderTabTrigger("salaries", "Salaries", Banknote)}
                  {renderTabTrigger("taxes", "Taxes", Receipt)}
                </TabsList>

                {canCreate && (
                  <form onSubmit={handleCreatePayee} className="mt-4 flex flex-col gap-2 p-3 border rounded-lg bg-muted/20">
                    <p className="text-xs text-muted-foreground">Bulk Paste (Format: CODE [tab or space] NAME)</p>
                    <textarea 
                      placeholder="DIR001 &#9; MUHAMMAD GHOUSE AKBAR&#10;DIR002 &#9; ADIL MATCHESWALA" 
                      value={bulkData} 
                      onChange={e => setBulkData(e.target.value)} 
                      className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={creatingPayee || !bulkData.trim()} className="h-8">
                        {creatingPayee ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                        Bulk Add
                      </Button>
                    </div>
                  </form>
                )}

                <div className="mt-4 border rounded-lg bg-card/50 overflow-hidden">
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
                      {filteredItems.length} records
                    </span>
                  </div>

                  <div className="h-64 overflow-y-auto divide-y pr-1">
                    {loadingData ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground font-medium">Fetching available records...</span>
                      </div>
                    ) : (
                      <>
                        {filteredItems.length === 0 ? (
                          <div className="py-12 text-center text-sm text-muted-foreground">
                            No records found matching query.
                          </div>
                        ) : (
                          filteredItems.map((item) => {
                            const itemName = item.name || item.employeeName;
                            const itemCode = item.code || item.employeeId;
                            
                            return (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors select-none"
                              >
                                <Checkbox
                                  id={`chk-${item.id}`}
                                  checked={selected[activeTab].has(item.id)}
                                  onCheckedChange={() => handleToggleSelect(item.id)}
                                />
                                <label
                                  htmlFor={`chk-${item.id}`}
                                  className="flex flex-1 items-center justify-between text-sm cursor-pointer"
                                >
                                  <span className="font-medium text-foreground">{itemName}</span>
                                  <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                                    {itemCode || "No Code"}
                                  </span>
                                </label>
                              </div>
                            );
                          })
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Tabs>
            </div>

            <DialogFooter className="pt-4 pb-10 border-t border-muted gap-2 sm:gap-0">
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
