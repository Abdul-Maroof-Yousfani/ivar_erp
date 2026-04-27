"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search, UserPlus, RefreshCcw, Users, Phone, MapPin,
    ChevronRight, X, Check, Loader2, Pencil, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/components/providers/auth-provider";

interface Customer {
    id: string;
    code: string;
    name: string;
    contactNo?: string;
    address?: string;
    createdAt: string;
}

const EMPTY_FORM = { code: "", name: "", contactNo: "", address: "" };

export default function PosCustomersPage() {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('pos.customer.create');
    const canUpdate = hasPermission('pos.customer.update');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);

    // Sheet — view/edit
    const [selected, setSelected] = useState<Customer | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Dialog — create / edit form
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    const fetchCustomers = useCallback(async (q = debouncedSearch) => {
        setIsLoading(true);
        try {
            const res = await authFetch("/sales/customers", { params: { search: q || undefined } });
            if (res.ok && res.data?.status) setCustomers(res.data.data || []);
            else setCustomers([]);
        } catch { setCustomers([]); }
        finally { setIsLoading(false); }
    }, [debouncedSearch]);

    useEffect(() => { fetchCustomers(); }, [debouncedSearch]);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setIsFormOpen(true);
    };

    const openEdit = (c: Customer) => {
        setEditingId(c.id);
        setForm({ code: c.code, name: c.name, contactNo: c.contactNo || "", address: c.address || "" });
        setIsSheetOpen(false);
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error("Code and Name are required.");
            return;
        }
        setIsSaving(true);
        try {
            const res = editingId
                ? await authFetch(`/sales/customers/${editingId}`, { method: "PATCH", body: JSON.stringify(form) })
                : await authFetch("/sales/customers", { method: "POST", body: JSON.stringify(form) });

            if (res.ok && res.data?.status) {
                toast.success(editingId ? "Customer updated." : "Customer created.");
                setIsFormOpen(false);
                fetchCustomers(debouncedSearch);
            } else {
                toast.error(res.data?.message || "Failed to save customer.");
            }
        } catch { toast.error("Something went wrong."); }
        finally { setIsSaving(false); }
    };

    const handleRowClick = (c: Customer) => {
        setSelected(c);
        setIsSheetOpen(true);
    };

    return (
        <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
            {/* Header */}
            <div
                className="flex-none p-4 md:p-6 pb-4 border-b bg-muted/20 backdrop-blur-xl sticky z-10"
                style={{ top: "calc(var(--banner-height) + 4rem)" }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Users className="h-6 w-6 text-primary" /> Customers
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                            {customers.length > 0 ? `${customers.length} customers` : "Search or add customers"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchCustomers()} disabled={isLoading}>
                            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        </Button>
                        <Button className="gap-2 font-semibold" onClick={openCreate} disabled={!canCreate}>
                            <UserPlus className="h-4 w-4" /> Add Customer
                        </Button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                    <Input
                        placeholder="Search by name, code, or phone…"
                        className="pl-9 h-11 bg-muted/30 border-border/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Table header */}
            {!isLoading && customers.length > 0 && (
                <div className="flex-none px-4 md:px-6 py-2 border-b bg-muted/10">
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20">Code</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:block">Phone</span>
                        <span className="w-5" />
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-auto divide-y divide-border/50">
                {isLoading ? (
                    <div className="p-4 space-y-2">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                    </div>
                ) : customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8">
                        <div className="h-20 w-20 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                            <Users className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <p className="font-semibold text-muted-foreground">
                            {search ? `No customers matching "${search}"` : "No customers yet"}
                        </p>
                        <p className="text-sm text-muted-foreground/60 mt-1">Add your first customer to get started</p>
                        <Button className="mt-4 gap-2" onClick={openCreate} disabled={!canCreate}>
                            <UserPlus className="h-4 w-4" /> Add Customer
                        </Button>
                    </div>
                ) : (
                    customers.map((c) => (
                        <button
                            key={c.id}
                            className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 md:px-6 py-3.5 hover:bg-muted/30 transition-colors text-left group"
                            onClick={() => handleRowClick(c)}
                        >
                            <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-1 rounded w-20 truncate text-center">
                                {c.code}
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{c.name}</p>
                                {c.address && (
                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                        <MapPin className="h-3 w-3 flex-none" />{c.address}
                                    </p>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                                {c.contactNo ? <><Phone className="h-3 w-3" />{c.contactNo}</> : "—"}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </button>
                    ))
                )}
            </div>

            {/* Detail Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader className="pb-4">
                        <SheetTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" /> Customer Details
                        </SheetTitle>
                    </SheetHeader>
                    {selected && (
                        <div className="space-y-5 flex-1 overflow-auto">
                            {/* Info card */}
                            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="text-lg font-bold">{selected.name}</p>
                                        <Badge variant="outline" className="font-mono text-xs mt-1">{selected.code}</Badge>
                                    </div>
                                    <Button variant="outline" size="sm" className="gap-1.5 flex-none" disabled={!canUpdate} onClick={() => openEdit(selected)}>
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                    </Button>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    {selected.contactNo && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground flex-none" />
                                            <span>{selected.contactNo}</span>
                                        </div>
                                    )}
                                    {selected.address && (
                                        <div className="flex items-start gap-2 text-sm">
                                            <MapPin className="h-4 w-4 text-muted-foreground flex-none mt-0.5" />
                                            <span>{selected.address}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Hash className="h-4 w-4 flex-none" />
                                        <span>Added {new Date(selected.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <SheetFooter className="pt-4">
                        <Button variant="outline" className="w-full" onClick={() => setIsSheetOpen(false)}>Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Create / Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            {editingId ? "Edit Customer" : "New Customer"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Code <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    placeholder="e.g. CUST-001"
                                    value={form.code}
                                    onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                                    className="bg-muted/30"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    placeholder="Full name"
                                    value={form.name}
                                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="bg-muted/30"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</Label>
                            <Input
                                placeholder="03xx-xxxxxxx"
                                value={form.contactNo}
                                onChange={(e) => setForm(f => ({ ...f, contactNo: e.target.value }))}
                                className="bg-muted/30"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Address</Label>
                            <Input
                                placeholder="Street, City"
                                value={form.address}
                                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                                className="bg-muted/30"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2 min-w-[100px]">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {editingId ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
