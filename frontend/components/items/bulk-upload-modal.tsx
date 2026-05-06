'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    Upload,
    FileText,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Download,
    X,
    History,
    Info,
    Database
} from 'lucide-react';
import { useUploadProgress, UploadError } from '@/hooks/use-upload-progress';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { getApiBaseUrl } from '@/lib/utils';

interface BulkUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function BulkUploadModal({ open, onOpenChange, onSuccess, uploadId, onUploadIdChange }: BulkUploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [internalUploadId, setInternalUploadId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const hasAutoConfirmed = React.useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync internal state with prop
    React.useEffect(() => {
        if (uploadId !== undefined) {
            setInternalUploadId(uploadId);
        }
    }, [uploadId]);

    // Drive the hook from internal state — never from the prop directly.
    // The prop is only used to restore state on mount (e.g. after page refresh).
    // Using the prop directly causes the view to flicker back to the file picker
    // during the brief window where onUploadIdChange(null) is called before the
    // new uploadId comes back, which kills the SSE connection mid-job.
    const activeId = internalUploadId ?? null;

    const { data, speed, isComplete, isValidated, isValidating, isFailed, isProcessing, isCancelled } = useUploadProgress(activeId);

    // Auto-scroll to latest errors
    const errorEndRef = useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (showErrors && errorEndRef.current) {
            errorEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [data?.errors?.length, showErrors]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const ext = selectedFile.name.split('.').pop()?.toLowerCase();
            if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
                setFile(selectedFile);
            } else {
                toast.error('Invalid file type. Please upload CSV or Excel files.');
            }
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        // Reset internal state only — don't touch the prop until we have a new ID
        setInternalUploadId(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${getApiBaseUrl()}/items/bulk-upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const result = await response.json();

            if (result.status && result.data?.uploadId) {
                setInternalUploadId(result.data.uploadId);
                onUploadIdChange?.(result.data.uploadId);
                toast.success('File uploaded. Validation started...');
            } else {
                toast.error(result.message || 'Failed to initiate upload');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('An error occurred during upload');
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirm = async () => {
        if (!activeId || isConfirming) return;

        setIsConfirming(true);
        try {
            const response = await fetch(`${getApiBaseUrl()}/items/bulk-upload/${activeId}/confirm`, {
                method: 'POST',
                credentials: 'include',
            });
            const result = await response.json();
            if (result.status) {
                toast.success('Import started');
            } else {
                toast.error(result.message || 'Failed to start import');
                setIsConfirming(false);
            }
        } catch (error) {
            console.error('Confirm failed:', error);
            toast.error('An error occurred during confirmation');
            setIsConfirming(false);
        }
    };

    const handleCancel = async () => {
        if (!activeId) return;

        try {
            const response = await fetch(`${getApiBaseUrl()}/items/bulk-upload/${activeId}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const result = await response.json();
            if (result.status) {
                toast.info('Job cancelled');
                onUploadIdChange?.(null);
                setInternalUploadId(null);
            }
        } catch (error) {
            console.error('Cancel failed:', error);
        }
    };

    const downloadTemplate = () => {
        window.open(`${getApiBaseUrl()}/items/bulk-upload/template/download`, '_blank');
    };

    const [isPreparingReport, setIsPreparingReport] = useState(false);
    const reportPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // React to SSE report generation events from the backend
    React.useEffect(() => {
        if (!data) return;
        const d = data as any;
        if (d.reportReady === true && isPreparingReport) {
            setIsPreparingReport(false);
            if (reportPollRef.current) { clearInterval(reportPollRef.current); reportPollRef.current = null; }
            toast.success('Error report ready. Downloading...');
            window.open(`${getApiBaseUrl()}/items/bulk-upload/${activeId}/error-report`, '_blank');
        }
    }, [(data as any)?.reportReady, (data as any)?.reportGenerating]);

    const downloadErrorReport = async () => {
        if (!activeId || isPreparingReport) return;

        setIsPreparingReport(true);
        try {
            const res = await fetch(`${getApiBaseUrl()}/items/bulk-upload/${activeId}/error-report?prepare=true`, {
                credentials: 'include',
            });
            const result = await res.json();

            if (result.data?.ready) {
                // JSONL already on disk — download immediately
                window.open(`${getApiBaseUrl()}/items/bulk-upload/${activeId}/error-report`, '_blank');
                setIsPreparingReport(false);
                return;
            }

            // Generation kicked off in background — SSE will fire reportReady when done
            toast.info('Generating error report in background. You\'ll be notified when it\'s ready...');
        } catch {
            toast.error('Failed to prepare error report');
            setIsPreparingReport(false);
        }
    };

    // Cleanup poll on unmount
    React.useEffect(() => {
        return () => { if (reportPollRef.current) clearInterval(reportPollRef.current); };
    }, []);

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
        // Just hide the modal, don't reset if processing
        if (isProcessing) {
            onOpenChange(false);
            return;
        }

        if (data?.status === 'completed' && onSuccess) {
            onSuccess();
            onUploadIdChange?.(null);
        }

        onOpenChange(false);
        // Only reset if we are done or failed
        if (data?.status === 'completed' || isFailed || isCancelled || !activeId) {
            setTimeout(reset, 300);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                showCloseButton={false}
                noScroll
                onInteractOutside={(e) => {
                    if (isProcessing) e.preventDefault();
                }}
                className="sm:max-w-[750px] w-full flex flex-col p-0 bg-card max-h-[90vh]"
            >
                <DialogHeader className="p-6 pb-2 border-b bg-muted/30 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <Upload className="h-6 w-6 text-primary" />
                        Bulk Item Management
                        {data?.status && (
                            <Badge variant="outline" className="ml-2 capitalize">
                                {data.status}
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Follow the two-step process: Validate your data, then commit to the database.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 w-full overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {!activeId ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* File Dropzone */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`
                                    border-2 border-dashed rounded-2xl p-12
                                    flex flex-col items-center justify-center gap-4 cursor-pointer
                                    transition-all duration-300 relative group
                                    ${file ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/50'}
                                `}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".csv,.xlsx,.xls"
                                        className="hidden"
                                    />

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
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFile(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                            >
                                                <X className="h-4 w-4 mr-2" /> Change File
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="font-bold text-xl">Upload items list</p>
                                                <p className="text-sm text-muted-foreground max-w-[300px]">
                                                    Drag and drop your CSV or Excel file here, or click to browse.
                                                </p>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <Badge variant="outline" className="bg-background/50">.CSV</Badge>
                                                <Badge variant="outline" className="bg-background/50">.XLSX</Badge>
                                                <Badge variant="outline" className="bg-background/50">.XLS</Badge>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Template Download */}
                                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center border shadow-sm">
                                            <Download className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Download Template</p>
                                            <p className="text-xs text-muted-foreground">Ensure your data matches the system requirements.</p>
                                        </div>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={downloadTemplate} className="font-semibold shadow-sm">
                                        Get CSV Template
                                    </Button>
                                </div>

                                {/* Features List */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex gap-4 p-4 rounded-xl border bg-card/50 transition-colors hover:bg-card">
                                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold">Smart Validation</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">Instantly identifies formatting errors and duplicates before DB entry.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 p-4 rounded-xl border bg-card/50 transition-colors hover:bg-card">
                                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                            <Loader2 className="h-5 w-5 text-amber-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold">SSE Streaming</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">Real-time progress updates with instant feedback on every row.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                {/* Progress Section */}
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
                                                    ? (data?.processedRecords ?? 0) > 0
                                                        ? `Scanning row ${data!.processedRecords.toLocaleString()}...`
                                                        : (data?.message || 'Preparing...')
                                                    : (data?.message || 'Preparing...')}
                                            </p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-4xl font-black text-primary">{data?.progress ?? 0}</span>
                                                <span className="text-xl font-bold text-primary/70">%</span>
                                            </div>
                                            {isProcessing && (speed > 0 || isValidating) && (
                                                <div className="flex flex-col items-end gap-1">
                                                    <Badge variant="secondary" className="font-mono text-[10px] py-0 px-2">
                                                        {isValidating ? 'Validating' : `${data?.recsPerSec || speed} recs/sec`}
                                                    </Badge>
                                                    {data?.memoryUsageMB && (
                                                        <Badge variant="outline" className="font-mono text-[10px] py-0 px-2 bg-background/50">
                                                            Server Mem: {data.memoryUsageMB}MB
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="relative pt-1">
                                        <Progress value={data?.progress ?? 0} className="h-4 rounded-full shadow-inner bg-muted" />
                                        <div
                                            className="absolute top-0 left-0 h-4 bg-white/20 rounded-full transition-all duration-500"
                                            style={{ width: `${data?.progress ?? 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-muted/40 p-5 rounded-2xl border flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Rows</span>
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

                                {/* Validation Results UI */}
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
                                                        ? "Excellent! Your file is perfect and ready to be imported."
                                                        : `Attention: ${data?.failedRecords} rows have issues and will be SKIPPED during import.`}
                                                </p>
                                            </div>
                                        </div>

                                        {(data?.failedRecords ?? 0) > 0 && (
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setShowErrors(!showErrors)} className="h-9 font-bold bg-background">
                                                    {showErrors ? 'Hide Error Details' : 'View Error Details'}
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={downloadErrorReport} disabled={isPreparingReport} className="h-9 font-bold text-destructive hover:bg-destructive/5">
                                                    {isPreparingReport
                                                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {(data as any)?.reportGenerating ? ((data as any)?.message || 'Generating...') : 'Preparing...'}</>
                                                        : <><Download className="h-4 w-4 mr-2" /> Download Full Report</>
                                                    }
                                                </Button>
                                            </div>
                                        )}

                                        {showErrors && data?.errors && data.errors.length > 0 && (
                                            <div className="border rounded-xl overflow-hidden shadow-sm bg-background/50">
                                                <ScrollArea className="h-[250px]">
                                                    <Table>
                                                        <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                                                            <TableRow>
                                                                <TableHead className="w-[60px] font-black uppercase text-[10px]">Row</TableHead>
                                                                <TableHead className="w-[100px] font-black uppercase text-[10px]">Field</TableHead>
                                                                <TableHead className="font-black uppercase text-[10px]">Issue Description</TableHead>
                                                                <TableHead className="font-black uppercase text-[10px]">Item ID</TableHead>
                                                                <TableHead className="font-black uppercase text-[10px]">BarCode</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {data?.errors?.slice(0, 100).map((err, i) => (
                                                                <TableRow key={i} className="hover:bg-muted/20 transition-colors">
                                                                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">{err.row}</TableCell>
                                                                    <TableCell className="text-xs font-bold capitalize">{err.data?.field || (err as any).field || 'unknown'}</TableCell>
                                                                    <TableCell className="text-xs text-destructive font-semibold">{err.reason}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{(err as any).itemId || '—'}</TableCell>
                                                                    <TableCell className="text-xs font-mono">{(err as any).barCode || '—'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                            {data?.errors && data.errors.length > 100 && (
                                                                <TableRow>
                                                                    <TableCell colSpan={4} className="text-center py-4 bg-muted/10">
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <p className="text-sm font-bold text-muted-foreground">
                                                                                Showing first 100 of {data.errors.length} errors
                                                                            </p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Please download the full report to see all issues.
                                                                            </p>
                                                                        </div>
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

                                {/* Final Completion State */}
                                {data?.status === 'completed' && (
                                    <div className="p-8 bg-green-500/5 border-2 border-green-500/20 rounded-3xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-500">
                                        <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/10">
                                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-green-700">Import Successful!</h3>
                                            <p className="text-green-600/80 font-medium">
                                                {data?.successRecords} items have been added to your inventory.
                                            </p>
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
                                    <Info className="h-3 w-3" />
                                    System is processing in the background...
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {!activeId ? (
                                <>
                                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold">
                                        Cancel
                                    </Button>
                                    <Button disabled={!file || isUploading} onClick={handleUpload} className="px-8 font-black shadow-lg shadow-primary/20">
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Queuing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-4 w-4 mr-2" />
                                                Start Validation
                                            </>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {isProcessing ? (
                                        <Button variant="destructive" onClick={handleCancel} className="font-bold">
                                            Abort Job
                                        </Button>
                                    ) : isValidated ? (
                                        <div className="flex gap-3">
                                            <Button variant="outline" onClick={reset} className="font-bold">
                                                Re-upload Corrected File
                                            </Button>
                                            <Button
                                                onClick={handleConfirm}
                                                disabled={isProcessing || isConfirming}
                                                className="px-10 font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                                            >
                                                {isConfirming ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Starting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Database className="mr-2 h-4 w-4" />
                                                        Confirm & Start Import
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button variant="outline" onClick={reset} className="font-bold">
                                            Upload Another
                                        </Button>
                                    )}
                                    {(data?.status === 'completed' || isFailed || isCancelled) && (
                                        <Button onClick={handleClose} className="font-black px-8">
                                            Done
                                        </Button>
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
