'use client';

import React, { useState, useRef } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, Loader2, Download, X, Info, Database } from 'lucide-react';
import { useUploadProgress } from '@/hooks/use-upload-progress';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getApiBaseUrl } from '@/lib/utils';

const BASE = () => `${getApiBaseUrl()}/sales/customers/bulk-upload`;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function CustomerBulkUploadModal({ open, onOpenChange, onSuccess, uploadId, onUploadIdChange }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [internalUploadId, setInternalUploadId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const hasAutoConfirmed = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const errorEndRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (uploadId !== undefined) setInternalUploadId(uploadId ?? null);
    }, [uploadId]);

    const activeId = internalUploadId ?? null;
    const { data, speed, isValidated, isValidating, isFailed, isProcessing, isCancelled } = useUploadProgress(activeId);

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
        try {
            const res = await fetch(BASE(), { method: 'POST', body: formData, credentials: 'include' });
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
        setIsConfirming(true);
        try {
            const res = await fetch(`${BASE()}/${activeId}/confirm`, { method: 'POST', credentials: 'include' });
            const result = await res.json();
            if (result.status) {
                toast.success('Import started');
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
            if (result.status) {
                toast.info('Job cancelled');
                onUploadIdChange?.(null);
                setInternalUploadId(null);
            }
        } catch { /* ignore */ }
    };

    const reset = () => {
        setFile(null);
        setInternalUploadId(null);
        onUploadIdChange?.(null);
        setIsUploading(false);
        setIsConfirming(false);
        setShowErrors(false);
        hasAutoConfirmed.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Auto-confirm if 100% valid
    React.useEffect(() => {
        if (isValidated && data?.failedRecords === 0 && !isProcessing && data?.status === 'validated' && !hasAutoConfirmed.current && !isConfirming) {
            hasAutoConfirmed.current = true;
            handleConfirm();
        }
    }, [isValidated, data?.failedRecords, data?.status, isProcessing, isConfirming]);

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
                        Bulk Customer Import
                        {data?.status && <Badge variant="outline" className="ml-2 capitalize">{data.status}</Badge>}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Two-step process: Validate your data, then commit to the database.
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
                                                <p className="font-bold text-xl">Upload customer list</p>
                                                <p className="text-sm text-muted-foreground max-w-[300px]">CSV or Excel with columns: Code, Name, Address, Contact No., Email</p>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                {['.CSV', '.XLSX', '.XLS'].map(ext => <Badge key={ext} variant="outline" className="bg-background/50">{ext}</Badge>)}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Template Download */}
                                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center border shadow-sm">
                                            <Download className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Download Template</p>
                                            <p className="text-xs text-muted-foreground">Columns: Code, Name of Customer, Address, Contact No., Email</p>
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
                                                    {isValidating ? 'Phase 1: Validating' : data?.status === 'processing' ? 'Phase 2: Importing' : 'Status'}
                                                </p>
                                            </div>
                                            <h3 className="text-2xl font-black truncate max-w-[400px]">{data?.filename}</h3>
                                            <p className="text-sm text-muted-foreground italic font-medium">
                                                {isValidating
                                                    ? (data?.processedRecords ?? 0) > 0 ? `Scanning row ${data!.processedRecords.toLocaleString()}...` : (data?.message || 'Preparing...')
                                                    : (data?.message || 'Preparing...')}
                                            </p>
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
                                    <div className="relative pt-1">
                                        <Progress value={data?.progress ?? 0} className="h-4 rounded-full shadow-inner bg-muted" />
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-muted/40 p-5 rounded-2xl border flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total</span>
                                        <span className="text-3xl font-black">{(data?.totalRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-green-500/10 p-5 rounded-2xl border border-green-500/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Valid</span>
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
                                                        ? 'All records are valid and ready to import.'
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

                                {/* Completion */}
                                {data?.status === 'completed' && (
                                    <div className="p-8 bg-green-500/5 border-2 border-green-500/20 rounded-3xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-500">
                                        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/10">
                                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-green-700">Import Successful!</h3>
                                            <p className="text-green-600/80 font-medium">{data?.successRecords} customers have been added/updated.</p>
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
                                    <Info className="h-3 w-3" /> Processing in the background...
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
                                    ) : isValidated ? (
                                        <div className="flex gap-3">
                                            <Button variant="outline" onClick={reset} className="font-bold">Re-upload File</Button>
                                            <Button onClick={handleConfirm} disabled={isProcessing || isConfirming} className="px-10 font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20">
                                                {isConfirming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</> : <><Database className="mr-2 h-4 w-4" /> Confirm & Import</>}
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
