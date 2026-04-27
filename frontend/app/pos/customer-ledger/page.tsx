"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, BookOpen, RefreshCw, Eye, Phone, Mail } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";

interface CustomerLedger {
    id: string;
    code: string;
    name: string;
    contactNo: string | null;
    email: string | null;
    address: string | null;
    balance: number;
    stats: {
        totalInvoices: number;
        totalInvoiced: number;
        totalPaid: number;
        outstandingBalance: number;
        totalOrders: number;
        totalOrdersAmount: number;
        totalPosSales: number;
        totalPosSalesAmount: number;
        grandTotalSales: number;
    };
    salesInvoices: any[];
    salesOrders: any[];
    posSales?: any[];
}

export default function CustomerLedgerPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<CustomerLedger[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`/sales/customers/ledger/summary?search=${search}`);
            if (res.ok && res.data?.status) {
                setCustomers(res.data.data || []);
            } else {
                toast.error(res.data?.message || "Failed to load customer ledger");
            }
        } catch {
            toast.error("Failed to load customer ledger");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    const handleSearch = () => {
        loadCustomers();
    };

    const handleViewDetails = async (customer: CustomerLedger) => {
        router.push(`/pos/customer-ledger/${customer.id}`);
    };

    const fmt = (val: number) => val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return (
        <div className="space-y-6 mt-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BookOpen className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-2xl font-bold">Customer Ledger</h1>
                        <p className="text-sm text-muted-foreground">
                            View customer balances and transaction history
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={loadCustomers} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Search */}
            <Card className="p-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, code, or contact..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={isLoading}>
                        Search
                    </Button>
                </div>
            </Card>

            {/* Customer List */}
            {isLoading ? (
                <div className="text-center py-16 text-muted-foreground">Loading...</div>
            ) : customers.length === 0 ? (
                <Card className="p-12 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No customers found</p>
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Customer Name</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead className="text-right">Total Sales</TableHead>
                                <TableHead className="text-right">POS Sales</TableHead>
                                <TableHead className="text-right">Outstanding</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-mono text-sm">{customer.code}</TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="font-semibold">{customer.name}</p>
                                            {customer.address && (
                                                <p className="text-xs text-muted-foreground truncate max-w-xs">
                                                    {customer.address}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {customer.contactNo && (
                                                <div className="flex items-center gap-1 text-xs">
                                                    <Phone className="h-3 w-3" />
                                                    {customer.contactNo}
                                                </div>
                                            )}
                                            {customer.email && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Mail className="h-3 w-3" />
                                                    {customer.email}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {fmt(customer.stats.grandTotalSales)}
                                    </TableCell>
                                    <TableCell className="text-right text-blue-600">
                                        {fmt(customer.stats.totalPosSalesAmount)}
                                        {customer.stats.totalPosSales > 0 && (
                                            <span className="text-xs text-muted-foreground ml-1">
                                                ({customer.stats.totalPosSales})
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className={customer.stats.outstandingBalance > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                                            {fmt(customer.stats.outstandingBalance)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {customer.stats.outstandingBalance > 0 ? (
                                            <Badge variant="destructive">Outstanding</Badge>
                                        ) : customer.stats.grandTotalSales > 0 ? (
                                            <Badge variant="default" className="bg-green-600">Paid</Badge>
                                        ) : (
                                            <Badge variant="outline">No Activity</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleViewDetails(customer)}
                                        >
                                            <Eye className="h-3 w-3 mr-1" />
                                            View
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
