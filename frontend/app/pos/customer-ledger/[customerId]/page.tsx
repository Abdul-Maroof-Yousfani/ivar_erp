"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { 
    ArrowLeft, 
    BookOpen, 
    RefreshCw, 
    Phone, 
    Mail, 
    MapPin, 
    Receipt, 
    ShoppingCart, 
    Store,
    TrendingUp,
    TrendingDown,
    DollarSign,
} from "lucide-react";

export default function CustomerDetailPage() {
    const router = useRouter();
    const params = useParams();
    const customerId = params.customerId as string;
    
    const [customer, setCustomer] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadCustomer = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`/sales/customers/ledger/${customerId}/transactions`);
            if (res.ok && res.data?.status) {
                setCustomer(res.data.data);
            } else {
                toast.error("Failed to load customer details");
            }
        } catch {
            toast.error("Failed to load customer details");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (customerId) {
            loadCustomer();
        }
    }, [customerId]);

    const fmt = (val: number) => val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-muted-foreground">Loading customer details...</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Customer not found</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/pos/customer-ledger")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Ledger
                    </Button>
                </div>
            </div>
        );
    }

    // Calculate stats
    const totalInvoiced = customer.salesInvoices?.reduce((sum: number, inv: any) => sum + Number(inv.grandTotal), 0) || 0;
    const totalPaid = customer.salesInvoices?.reduce((sum: number, inv: any) => sum + Number(inv.paidAmount), 0) || 0;
    const totalOrders = customer.salesOrders?.reduce((sum: number, order: any) => sum + Number(order.grandTotal), 0) || 0;
    const totalPosSales = customer.posSales?.reduce((sum: number, sale: any) => sum + Number(sale.grandTotal), 0) || 0;
    const posCreditSales = customer.posSales?.filter((s: any) => s.paymentStatus === 'unpaid') || []; // Only unpaid, not partial
    const totalPosCredit = posCreditSales.reduce((sum: number, sale: any) => sum + Number(sale.grandTotal), 0);
    const outstandingBalance = (totalInvoiced - totalPaid) + totalPosCredit;
    const grandTotalSales = totalInvoiced + totalOrders + totalPosSales;

    return (
        <div className="space-y-6 mt-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/pos/customer-ledger")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{customer.name}</h1>
                        <p className="text-sm text-muted-foreground">Customer Code: {customer.code}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={loadCustomer} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Current Balance */}
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                        <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold">{fmt(Number(customer.balance))}</p>
                    <p className="text-xs text-muted-foreground mt-1">Account balance</p>
                </Card>

                {/* Total Sales */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold">{fmt(grandTotalSales)}</p>
                    <p className="text-xs text-muted-foreground mt-1">All transactions</p>
                </Card>

                {/* Outstanding */}
                <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                        <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-3xl font-bold text-red-600">{fmt(outstandingBalance)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Unpaid amount</p>
                </Card>

                {/* POS Sales */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">POS Sales</p>
                        <Store className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold">{customer.posSales?.length || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmt(totalPosSales)} total</p>
                </Card>
            </div>

            {/* Contact Information */}
            <Card className="p-6">
                <h2 className="font-semibold mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {customer.contactNo && (
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Phone</p>
                                <p className="font-medium">{customer.contactNo}</p>
                            </div>
                        </div>
                    )}
                    {customer.email && (
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="font-medium text-sm">{customer.email}</p>
                            </div>
                        </div>
                    )}
                    {customer.address && (
                        <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                            <div>
                                <p className="text-xs text-muted-foreground">Address</p>
                                <p className="font-medium text-sm">{customer.address}</p>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Transactions Tabs */}
            <Card className="p-6">
                <Tabs defaultValue="pos" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="pos" className="gap-2">
                            <Store className="h-4 w-4" />
                            POS Sales ({customer.posSales?.length || 0})
                        </TabsTrigger>
                        <TabsTrigger value="invoices" className="gap-2">
                            <Receipt className="h-4 w-4" />
                            Invoices ({customer.salesInvoices?.length || 0})
                        </TabsTrigger>
                        <TabsTrigger value="orders" className="gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            Orders ({customer.salesOrders?.length || 0})
                        </TabsTrigger>
                    </TabsList>

                    {/* POS Sales Tab */}
                    <TabsContent value="pos" className="mt-6">
                        {customer.posSales?.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Date & Time</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Payment Method</TableHead>
                                        <TableHead>Payment Status</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.posSales.map((sale: any) => (
                                        <TableRow 
                                            key={sale.id}
                                            className={sale.paymentStatus !== 'paid' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                                        >
                                            <TableCell className="font-mono text-sm font-semibold">{sale.orderNumber}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p>{new Date(sale.createdAt).toLocaleDateString()}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(sale.createdAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold">{fmt(Number(sale.grandTotal))}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {sale.paymentMethod?.replace(/_/g, ' ') || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={
                                                        sale.paymentStatus === 'paid' 
                                                            ? 'default' 
                                                            : sale.paymentStatus === 'partial'
                                                            ? 'secondary'
                                                            : 'destructive'
                                                    }
                                                    className={`capitalize ${
                                                        sale.paymentStatus === 'paid' 
                                                            ? 'bg-green-600 hover:bg-green-700' 
                                                            : sale.paymentStatus === 'partial'
                                                            ? 'bg-yellow-600 hover:bg-yellow-700'
                                                            : ''
                                                    }`}
                                                >
                                                    {sale.paymentStatus}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {sale.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12">
                                <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No POS sales found</p>
                            </div>
                        )}
                    </TabsContent>

                    {/* Invoices Tab */}
                    <TabsContent value="invoices" className="mt-6">
                        {customer.salesInvoices?.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.salesInvoices.map((inv: any) => {
                                        const balance = Number(inv.grandTotal) - Number(inv.paidAmount);
                                        return (
                                            <TableRow key={inv.id}>
                                                <TableCell className="font-mono text-sm font-semibold">{inv.invoiceNo}</TableCell>
                                                <TableCell>{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right font-bold">{fmt(Number(inv.grandTotal))}</TableCell>
                                                <TableCell className="text-right text-green-600 font-semibold">
                                                    {fmt(Number(inv.paidAmount))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={balance > 0 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                                                        {fmt(balance)}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={inv.status === 'PAID' ? 'default' : 'destructive'}>
                                                        {inv.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12">
                                <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No invoices found</p>
                            </div>
                        )}
                    </TabsContent>

                    {/* Orders Tab */}
                    <TabsContent value="orders" className="mt-6">
                        {customer.salesOrders?.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.salesOrders.map((order: any) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-mono text-sm font-semibold">{order.orderNo}</TableCell>
                                            <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right font-bold">{fmt(Number(order.grandTotal))}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">{order.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="text-center py-12">
                                <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No orders found</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}
