'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, Building2 } from 'lucide-react';
import { RequestForQuotation, RfqVendor } from '@/lib/api';

interface RfqVendorTableProps {
    rfq: RequestForQuotation;
}

export function RfqVendorTable({ rfq }: RfqVendorTableProps) {
    const [printingVendor, setPrintingVendor] = useState<RfqVendor | null>(null);

    const handlePrint = (vendor: RfqVendor) => {
        setPrintingVendor(vendor);
        // Allow state to update and render the print view before triggering print
        setTimeout(() => {
            window.print();
            // Optional: clear printing vendor after print dialog closes (though tricky to detect reliably)
            // For now, we keep it rendered or user can close it if we make it a modal.
            // But with the CSS overlay technique, we might want to clear it after a delay or on user action.
            // A better UX might be to have a "Close Print View" button if it sticks, 
            // but window.print() is blocking in many browsers. 
            // Let's rely on the CSS print media query to only show it *during* print, 
            // but we need it in the DOM. 
            // Actually, if we use the same technique as PurchaseOrder, we need the element to be visible *to the browser's print engine*.
            // We can leave `printingVendor` set, but maybe we want to hide it from the *screen* user?
            // The PurchaseOrder example hid the dashboard and showed the print view *on screen* when printing? 
            // No, it used `@media print` to hide body and show `#print-section`.
            // So we can render the print section always but hidden, and only populate it when `printingVendor` is set.
        }, 100);
    };

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Vendor Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Sent At</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rfq.vendors.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">No vendors added yet.</TableCell>
                        </TableRow>
                    ) : (
                        rfq.vendors.map((v: RfqVendor) => (
                            <TableRow key={v.id}>
                                <TableCell className="font-medium">{v.vendor.code}</TableCell>
                                <TableCell>{v.vendor.name}</TableCell>
                                <TableCell>{v.vendor.email || '-'}</TableCell>
                                <TableCell>{v.vendor.contactNo || '-'}</TableCell>
                                <TableCell>{v.sentAt ? new Date(v.sentAt).toLocaleDateString() : '-'}</TableCell>
                                <TableCell>
                                    <Badge variant={v.responseStatus === 'RESPONDED' ? 'default' : 'outline'}>
                                        {v.responseStatus}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="sm" onClick={() => handlePrint(v)}>
                                        <Printer className="h-4 w-4 mr-2" /> Print
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Hidden Print Section */}
            {printingVendor && (
                <div id="print-section" className="hidden print:block">
                     <style jsx global>{`
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            #print-section, #print-section * {
                                visibility: visible;
                            }
                            #print-section {
                                position: fixed;
                                top: 0;
                                left: 0;
                                width: 100vw;
                                height: 100vh;
                                margin: 0;
                                padding: 20px;
                                background: white;
                                z-index: 9999;
                            }
                            @page {
                                margin: 0;
                                size: auto;
                            }
                        }
                    `}</style>

                    <div className="max-w-4xl mx-auto border-none shadow-none">
                        {/* Header Section */}
                        <div className="p-8 border-b">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-primary font-bold text-2xl mb-2">
                                        <Building2 className="h-8 w-8" />
                                        <span>Speed Limit ERP</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">123 Business Avenue</p>
                                    <p className="text-sm text-muted-foreground">Karachi, Pakistan</p>
                                    <p className="text-sm text-muted-foreground">Phone: +92 300 1234567</p>
                                    <p className="text-sm text-muted-foreground">Email: procurement@speedlimit.com</p>
                                </div>
                                <div className="text-right">
                                    <h1 className="text-3xl font-bold text-gray-900 mb-2">REQUEST FOR QUOTATION</h1>
                                    <div className="space-y-1">
                                        <p className="text-sm"><span className="font-semibold">RFQ Number:</span> {rfq.rfqNumber}</p>
                                        <p className="text-sm"><span className="font-semibold">Date:</span> {new Date(rfq.rfqDate).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Vendor Section */}
                        <div className="p-8 border-b">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">To Vendor</h3>
                            <div className="text-sm space-y-1">
                                <p className="font-bold text-gray-900 text-lg">{printingVendor.vendor.name}</p>
                                <p className="text-muted-foreground">Code: {printingVendor.vendor.code}</p>
                                <p className="text-muted-foreground">{printingVendor.vendor.email || 'No Email Provided'}</p>
                                <p className="text-muted-foreground">{printingVendor.vendor.contactNo || 'No Phone Provided'}</p>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="p-8">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50 border-t border-b border-gray-200">
                                        <TableHead className="font-bold text-gray-900">Item Details</TableHead>
                                        <TableHead className="text-right font-bold text-gray-900">Quantity</TableHead>
                                        <TableHead className="text-right font-bold text-gray-900">Needed By</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rfq.purchaseRequisition?.items.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-transparent">
                                            <TableCell>
                                                <div className="font-medium text-gray-900">{item.itemId}</div>
                                                <div className="text-sm text-muted-foreground">{item.description || '-'}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{parseFloat(item.requiredQty).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {item.neededByDate ? new Date(item.neededByDate).toLocaleDateString() : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Footer / Notes */}
                        <div className="p-8 border-t grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Notes & Instructions:</h4>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {rfq.notes || "Please submit your quotation within 7 days."}
                                </p>
                            </div>
                            <div className="pt-8 md:pt-0">
                                <div className="h-16 border-b border-black mb-2"></div>
                                <p className="text-center text-sm font-medium">Authorized Signature</p>
                                <p className="text-center text-xs text-muted-foreground mt-1">Innovative Network Pvt Ltd</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
