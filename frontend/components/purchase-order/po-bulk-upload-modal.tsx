'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, Loader2, Download, X, Info, Database } from 'lucide-react';
import { useUploadProgress } from '@/hooks/use-upload-progress';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getApiBaseUrl } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getVendors } from '@/lib/actions/procurement';

const BASE = () => `${getApiBaseUrl()}/purchase-order/bulk-upload`;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
    vendorId?: string;
    orderType?: string;
    goodsType?: string;
    expectedDeliveryDate?: string;
    notes?: string;
}

export function PoBulkUploadModal({ open, onOpenChange, onSuccess, uploadId, onUploadIdChange, vendorId, orderType, goodsType, expectedDeliveryDate, notes }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [internalUploadId, setInternalUploadId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const hasAutoConfirmed = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const errorEndRef = useRef<HTMLDivElement>(null);

    // Vendor and PO Metadata states
    const [vendors, setVendors] = useState<any[]>([]);
    const [isLoadingVendors, setIsLoadingVendors] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState<string>('');
    const [selectedOrderType, setSelectedOrderType] = useState<string>('LOCAL');
    const [selectedGoodsType, setSelectedGoodsType] = useState<string>('CONSUMABLE');
    const [selectedExpectedDeliveryDate, setSelectedExpectedDeliveryDate] = useState<string>('');
    const [selectedNotes, setSelectedNotes] = useState<string>('');

    // Sync input props into local states when modal opens
    React.useEffect(() => {
        if (open) {
            setSelectedVendorId(vendorId || '');
            setSelectedOrderType(orderType || 'LOCAL');
            setSelectedGoodsType(goodsType || 'CONSUMABLE');
            setSelectedExpectedDeliveryDate(expectedDeliveryDate || '');
            setSelectedNotes(notes || '');
        }
    }, [open, vendorId, orderType, goodsType, expectedDeliveryDate, notes]);

    // Fetch vendors when modal is open and validation completes
    const activeId = internalUploadId ?? null;
    const { data, speed, isValidated, isValidating, isFailed, isProcessing, isCancelled } = useUploadProgress(activeId);

    React.useEffect(() => {
        if (open && activeId && data?.status === 'validated') {
            const fetchVendorsList = async () => {
                setIsLoadingVendors(true);
                try {
                    const res = await getVendors();
                    if (res?.status && res.data) {
                        setVendors(res.data);
                        // Auto-toggle orderType based on vendor selection if already set
                        if (selectedVendorId) {
                            const match = res.data.find((v: any) => v.id === selectedVendorId);
                            if (match) {
                                const resolvedType = match.type === 'IMPORT' || match.type === 'INTERNATIONAL' ? 'IMPORT' : 'LOCAL';
                                setSelectedOrderType(resolvedType);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching vendors:', e);
                } finally {
                    setIsLoadingVendors(false);
                }
            };
            fetchVendorsList();
        }
    }, [open, activeId, data?.status, selectedVendorId]);

    const handleVendorChange = (id: string) => {
        setSelectedVendorId(id);
        const match = vendors.find(v => v.id === id);
        if (match) {
            const resolvedType = match.type === 'IMPORT' || match.type === 'INTERNATIONAL' ? 'IMPORT' : 'LOCAL';
            setSelectedOrderType(resolvedType);
        }
    };



    React.useEffect(() => {
        if (showErrors && errorEndRef.current) errorEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [data?.errors?.length, showErrors]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
            setFile(f);
        } else {
            toast.error('Invalid file type. Please upload CSV or Excel files.');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setInternalUploadId(null);
        const formData = new FormData();
        formData.append('file', file);

        const params = new URLSearchParams();
        if (vendorId) params.append('vendorId', vendorId);
        if (orderType) params.append('orderType', orderType);
        if (goodsType) params.append('goodsType', goodsType);
        if (expectedDeliveryDate) params.append('expectedDeliveryDate', expectedDeliveryDate);
        if (notes) params.append('notes', notes);
        const queryStr = params.toString();
        const url = queryStr ? `${BASE()}?${queryStr}` : BASE();

        try {
            const res = await fetch(url, { method: 'POST', body: formData, credentials: 'include' });
            const result = await res.json();
            if (result.status && result.data?.uploadId) {
                setInternalUploadId(result.data.uploadId);
                onUploadIdChange?.(result.data.uploadId);
                toast.success('File uploaded. Validation started...');
            } else {
                toast.error(result.message || 'Failed to initiate upload');
            }
        } catch {
            toast.error('An error occurred during upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirm = async () => {
        if (!activeId || isConfirming) return;
        if (!selectedVendorId) {
            toast.error('Please select a Vendor before confirming.');
            return;
        }
        setIsConfirming(true);

        const params = new URLSearchParams();
        params.append('vendorId', selectedVendorId);
        params.append('orderType', selectedOrderType);
        params.append('goodsType', selectedGoodsType);
        if (selectedExpectedDeliveryDate) params.append('expectedDeliveryDate', selectedExpectedDeliveryDate);
        if (selectedNotes) params.append('notes', selectedNotes);
        const queryStr = params.toString();
        const url = `${BASE()}/${activeId}/confirm?${queryStr}`;

        try {
            const res = await fetch(url, { method: 'POST', credentials: 'include' });
            const result = await res.json();
            if (result.status) {
                toast.success('PO import started');
            } else {
                toast.error(result.message || 'Failed to start import');
                setIsConfirming(false);
            }
        } catch {
            toast.error('An error occurred during confirmation');
            setIsConfirming(false);
        }
    };

    const handleCancel = async () => {
        if (!activeId) return;
        try {
            const res = await fetch(`${BASE()}/${activeId}`, { method: 'DELETE', credentials: 'include' });
            const result = await res.json();
            if (result.status) { toast.info('Job cancelled'); onUploadIdChange?.(null); setInternalUploadId(null); }
        } catch { /* ignore */ }
    };

    const reset = () => {
        setFile(null); setInternalUploadId(null); onUploadIdChange?.(null);
        setIsUploading(false); setIsConfirming(false); setShowErrors(false);
        hasAutoConfirmed.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        if (isProcessing) { onOpenChange(false); return; }
        if (data?.status === 'completed' && onSuccess) { onSuccess(); onUploadIdChange?.(null); }
        onOpenChange(false);
        if (data?.status === 'completed' || isFailed || isCancelled || !activeId) setTimeout(reset, 300);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                showCloseButton={false}
                noScroll
                onInteractOutside={(e) => { if (isProcessing) e.preventDefault(); }}
                className="sm:max-w-[750px] w-full flex flex-col p-0 bg-card max-h-[90vh]"
            >
                <DialogHeader className="p-6 pb-2 border-b bg-muted/30 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <Upload className="h-6 w-6 text-primary" />
                        Bulk PO Import
                        {data?.status && <Badge variant="outline" className="ml-2 capitalize">{data.status}</Badge>}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Upload a CSV/Excel containing BarCode and Quantity. Item details will be resolved automatically from the selected vendor and master data.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 w-full overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {!activeId ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Dropzone */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 group ${file ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/50'}`}
                                >
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx,.xls" className="hidden" />
                                    {file ? (
                                        <>
                                            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                                                <FileText className="h-10 w-10 text-primary" />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <p className="font-bold text-xl">{file.name}</p>
                                                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                                    <Badge variant="secondary" className="font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</Badge>
                                                    Ready for validation
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                                                <X className="h-4 w-4 mr-2" /> Change File
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="font-bold text-xl">Upload PO items list</p>
                                                <p className="text-sm text-muted-foreground max-w-xs">
                                                    One row per item. The file should only contain BarCode and Quantity columns.
                                                </p>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {['.CSV', '.XLSX', '.XLS'].map(ext => <Badge key={ext} variant="outline" className="bg-background/50">{ext}</Badge>)}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Template + column hint */}
                                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center border shadow-sm">
                                            <Download className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Download Template</p>
                                            <p className="text-xs text-muted-foreground">BarCode, Quantity</p>
                                        </div>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={() => window.open(`${BASE()}/template/download`, '_blank')} className="font-semibold shadow-sm">
                                        Get CSV Template
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                {/* Progress */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                                <p className="text-sm font-bold text-primary uppercase tracking-widest">
                                                    {isValidating ? 'Phase 1: Validating' : data?.status === 'processing' ? 'Phase 2: Creating POs' : 'Status'}
                                                </p>
                                            </div>
                                            <h3 className="text-2xl font-black truncate max-w-[400px]">{data?.filename}</h3>
                                            <p className="text-sm text-muted-foreground italic font-medium">{data?.message || 'Preparing...'}</p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-4xl font-black text-primary">{data?.progress ?? 0}</span>
                                                <span className="text-xl font-bold text-primary/70">%</span>
                                            </div>
                                            {isProcessing && speed > 0 && (
                                                <Badge variant="secondary" className="font-mono text-[10px] py-0 px-2">
                                                    {isValidating ? 'Validating' : `${data?.recsPerSec || speed} recs/sec`}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Progress value={data?.progress ?? 0} className="h-4 rounded-full shadow-inner bg-muted" />
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-muted/40 p-5 rounded-2xl border flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Rows</span>
                                        <span className="text-3xl font-black">{(data?.totalRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-green-500/10 p-5 rounded-2xl border border-green-500/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">{data?.status === 'completed' ? 'POs Created' : 'Valid'}</span>
                                        <span className="text-3xl font-black text-green-600">{(data?.successRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-destructive/10 p-5 rounded-2xl border border-destructive/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-destructive uppercase tracking-widest mb-1">Invalid</span>
                                        <span className="text-3xl font-black text-destructive">{(data?.failedRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Processed</span>
                                        <span className="text-3xl font-black text-amber-600">{(data?.processedRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Validation Results */}
                                {isValidated && (
                                    <div className="p-6 rounded-2xl border-2 border-dashed bg-card space-y-4 animate-in zoom-in-95 duration-500">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                                <CheckCircle2 className="h-7 w-7 text-green-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg">Validation Complete</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {data?.failedRecords === 0
                                                        ? 'All rows valid. Please set your PO import parameters below to finish.'
                                                        : `${data?.failedRecords} rows have issues and will be skipped.`}
                                                </p>
                                            </div>
                                        </div>

                                        {(data?.failedRecords ?? 0) > 0 && (
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setShowErrors(!showErrors)} className="h-9 font-bold bg-background">
                                                    {showErrors ? 'Hide Errors' : 'View Errors'}
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => window.open(`${BASE()}/${activeId}/error-report`, '_blank')} className="h-9 font-bold text-destructive hover:bg-destructive/5">
                                                    <Download className="h-4 w-4 mr-2" /> Download Report
                                                </Button>
                                            </div>
                                        )}

                                        {showErrors && data?.errors && data.errors.length > 0 && (
                                            <div className="border rounded-xl overflow-hidden shadow-sm bg-background/50">
                                                <ScrollArea className="h-[250px]">
                                                    <Table>
                                                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                            <TableRow>
                                                                <TableHead className="w-[60px] font-black uppercase text-[10px]">Row</TableHead>
                                                                <TableHead className="w-[100px] font-black uppercase text-[10px]">Field</TableHead>
                                                                <TableHead className="font-black uppercase text-[10px]">Issue</TableHead>
                                                                <TableHead className="font-black uppercase text-[10px]">Value</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {data.errors.slice(0, 100).map((err, i) => (
                                                                <TableRow key={i} className="hover:bg-muted/20">
                                                                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">{err.row}</TableCell>
                                                                    <TableCell className="text-xs font-bold capitalize">{(err as any).field || err.data?.field || 'unknown'}</TableCell>
                                                                    <TableCell className="text-xs text-destructive font-semibold">{err.reason}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{(err as any).value || err.data?.value || '—'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                            {data.errors.length > 100 && (
                                                                <TableRow>
                                                                    <TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground font-bold">
                                                                        Showing 100 of {data.errors.length} errors. Download full report for all.
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                            <div ref={errorEndRef} />
                                                        </TableBody>
                                                    </Table>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Metadata Settings Form */}
                                {isValidated && data?.status === 'validated' && (
                                    <div className="p-6 rounded-2xl border bg-muted/20 space-y-4 animate-in fade-in duration-300">
                                        <div className="flex items-center gap-2 border-b pb-3 mb-2">
                                            <Database className="h-5 w-5 text-primary animate-pulse" />
                                            <h4 className="font-bold text-base text-foreground">Import Purchase Order Settings</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Vendor Selection */}
                                            <div className="space-y-2">
                                                <Label htmlFor="modal-vendor" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                                    Vendor / Supplier <span className="text-destructive">*</span>
                                                </Label>
                                                <Select value={selectedVendorId} onValueChange={handleVendorChange} disabled={isLoadingVendors}>
                                                    <SelectTrigger id="modal-vendor" className="bg-background border-muted hover:border-primary/50 transition-colors h-10 font-medium">
                                                        <SelectValue placeholder={isLoadingVendors ? "Loading vendors..." : "Select Vendor"} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {vendors.map((vendor) => (
                                                            <SelectItem key={vendor.id} value={vendor.id} className="font-medium">
                                                                {vendor.name} ({vendor.code})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Order Type */}
                                            <div className="space-y-2">
                                                <Label htmlFor="modal-ordertype" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    Order Type
                                                </Label>
                                                <Select value={selectedOrderType} onValueChange={setSelectedOrderType}>
                                                    <SelectTrigger id="modal-ordertype" className="bg-background border-muted hover:border-primary/50 transition-colors h-10 font-medium">
                                                        <SelectValue placeholder="Select Order Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="LOCAL" className="font-medium">Local</SelectItem>
                                                        <SelectItem value="IMPORT" className="font-medium">Import</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Goods Type */}
                                            <div className="space-y-2">
                                                <Label htmlFor="modal-goodstype" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    Goods Type
                                                </Label>
                                                <Select value={selectedGoodsType} onValueChange={setSelectedGoodsType}>
                                                    <SelectTrigger id="modal-goodstype" className="bg-background border-muted hover:border-primary/50 transition-colors h-10 font-medium">
                                                        <SelectValue placeholder="Select Goods Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="CONSUMABLE" className="font-medium">Consumable</SelectItem>
                                                        <SelectItem value="FRESH" className="font-medium">Finish Goods / Fresh</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Expected Delivery Date */}
                                            <div className="space-y-2">
                                                <Label htmlFor="modal-deliverydate" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    Expected Delivery Date
                                                </Label>
                                                <Input
                                                    id="modal-deliverydate"
                                                    type="date"
                                                    value={selectedExpectedDeliveryDate}
                                                    onChange={(e) => setSelectedExpectedDeliveryDate(e.target.value)}
                                                    className="bg-background border-muted hover:border-primary/50 transition-colors h-10 font-medium"
                                                />
                                            </div>

                                            {/* Notes */}
                                            <div className="col-span-2 space-y-2">
                                                <Label htmlFor="modal-notes" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    Notes / Remarks
                                                </Label>
                                                <Textarea
                                                    id="modal-notes"
                                                    value={selectedNotes}
                                                    onChange={(e) => setSelectedNotes(e.target.value)}
                                                    placeholder="Add administrative notes or details for this purchase order..."
                                                    className="bg-background border-muted hover:border-primary/50 transition-colors font-medium min-h-[60px] max-h-[120px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Completion */}
                                {data?.status === 'completed' && (
                                    <div className="p-8 bg-green-500/5 border-2 border-green-500/20 rounded-3xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-500">
                                        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/10">
                                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-green-700">Import Successful!</h3>
                                            <p className="text-green-600/80 font-medium">{data?.successRecords} Purchase Orders created.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
                    <div className="flex justify-between w-full items-center">
                        <div className="max-w-[300px]">
                            {isProcessing && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold italic">
                                    <Info className="h-3 w-3" /> Creating POs in the background...
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {!activeId ? (
                                <>
                                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">Cancel</Button>
                                    <Button disabled={!file || isUploading} onClick={handleUpload} className="px-8 font-black shadow-lg shadow-primary/20">
                                        {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Queuing...</> : <><Upload className="h-4 w-4 mr-2" /> Start Validation</>}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {isProcessing ? (
                                        <Button variant="destructive" onClick={handleCancel} className="font-bold">Abort Job</Button>
                                    ) : isValidated && data?.status === 'validated' ? (
                                        <div className="flex gap-3">
                                            <Button variant="outline" onClick={reset} className="font-bold" disabled={isProcessing || isConfirming}>Re-upload File</Button>
                                            <Button 
                                                onClick={handleConfirm} 
                                                disabled={isProcessing || isConfirming || !selectedVendorId} 
                                                className="px-10 font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isConfirming ? (
                                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</>
                                                ) : !selectedVendorId ? (
                                                    <><Database className="mr-2 h-4 w-4" /> Select Vendor First</>
                                                ) : (
                                                    <><Database className="mr-2 h-4 w-4" /> Confirm & Create POs</>
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button variant="outline" onClick={reset} className="font-bold">Upload Another</Button>
                                    )}
                                    {(data?.status === 'completed' || isFailed || isCancelled) && (
                                        <Button onClick={handleClose} className="font-black px-8">Done</Button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
