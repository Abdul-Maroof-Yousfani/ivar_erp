"use client";

import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
    Clock,
    CheckCircle2,
    XCircle,
    Package,
    ArrowRightLeft,
    MapPin,
    Calendar,
    Hash,
    Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface StockTransferHistoryListProps {
    initialEntries: any[];
}

export function StockTransferHistoryList({ initialEntries }: StockTransferHistoryListProps) {
    if (initialEntries.length === 0) {
        return (
            <Card className="border-dashed h-[200px] flex items-center justify-center bg-muted/5">
                <div className="text-center">
                    <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground font-medium">No transfer records found</p>
                </div>
            </Card>
        );
    }

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case 'PENDING':
                return (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100/80 border-orange-200 gap-1 capitalize">
                        <Clock className="h-3 w-3" /> {status.toLowerCase()}
                    </Badge>
                );
            case 'COMPLETED':
                return (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100/80 border-green-200 gap-1 capitalize">
                        <CheckCircle2 className="h-3 w-3" /> {status.toLowerCase()}
                    </Badge>
                );
            case 'CANCELLED':
                return (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100/80 border-red-200 gap-1 capitalize">
                        <XCircle className="h-3 w-3" /> {status.toLowerCase()}
                    </Badge>
                );
            default:
                return <Badge variant="outline" className="capitalize">{status.toLowerCase()}</Badge>;
        }
    };

    return (
        <Card className="overflow-hidden shadow-sm border-2">
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="font-bold"><Hash className="h-4 w-4 inline mr-1" /> Request No</TableHead>
                            <TableHead className="font-bold"><Calendar className="h-4 w-4 inline mr-1" /> Date</TableHead>
                            <TableHead className="font-bold"><ArrowRightLeft className="h-4 w-4 inline mr-1" /> Transfer Path</TableHead>
                            <TableHead className="font-bold"><Package className="h-4 w-4 inline mr-1" /> Item Details</TableHead>
                            <TableHead className="font-bold text-center">Qty</TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                            <TableHead className="font-bold text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {initialEntries.map((transfer) => (
                            <TableRow key={transfer.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-mono font-bold text-sm">
                                    {transfer.requestNo}
                                </TableCell>
                                <TableCell className="text-sm">
                                    {format(new Date(transfer.createdAt), "dd MMM yyyy, HH:mm")}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            <Badge variant="outline" className="px-1.5 py-0 h-5 bg-background">FROM</Badge>
                                            <span className="text-muted-foreground">{transfer.fromWarehouse?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                                            <Badge variant="outline" className="px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">TO</Badge>
                                            <span className="font-bold">{transfer.toLocation?.name || transfer.toWarehouse?.name}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {transfer.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex flex-col">
                                            <span className="font-bold text-sm leading-tight">{item.item?.description}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">SKU: {item.item?.sku}</span>
                                        </div>
                                    ))}
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className="text-lg font-black text-primary">
                                        {Number(transfer.items[0]?.quantity || 0)}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {getStatusBadge(transfer.status)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/erp/inventory/transactions/stock-transfer/slip/${transfer.id}`} target="_blank">
                                            <Printer className="h-4 w-4 mr-2" />
                                            Print
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
