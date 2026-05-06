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
    Database,
    Info,
    UserPlus
} from 'lucide-react';
import { useUploadProgress } from '@/hooks/use-upload-progress';
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
import { getApiBaseUrl } from '@/lib/utils';

interface EmployeeBulkUploadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    uploadId?: string | null;
    onUploadIdChange?: (id: string | null) => void;
}

export function EmployeeBulkUploadModal({
    open,
    onOpenChange,
    onSuccess,
    uploadId,
    onUploadIdChange
}: EmployeeBulkUploadModalProps) {
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

    const activeId = internalUploadId ?? null;

    const {
        data,
        speed,
        isComplete,
        isValidated,
        isValidating,
        isFailed,
        isProcessing,
        isCancelled
    } = useUploadProgress(activeId, 'employee');

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
        setInternalUploadId(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${getApiBaseUrl()}/employees/import-csv`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });

            const result = await response.json();

            if (result.status !== false && result.uploadId) {
                setInternalUploadId(result.uploadId);
                onUploadIdChange?.(result.uploadId);
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
            const response = await fetch(`${getApiBaseUrl()}/employees/bulk-upload/${activeId}/confirm`, {
                method: 'POST',
                credentials: 'include',
            });
            const result = await response.json();
            if (result.status !== false) {
                toast.success('Employee import started');
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
        // Logic for cancelling if backend supports it
        toast.info('Job cancellation in progress...');
    };

    const downloadTemplate = () => {
        // Assuming template resides at this URL
        window.open(`${getApiBaseUrl()}/employees/import-template`, '_blank');
    };

    const downloadErrorReport = () => {
        if (!activeId) return;
        window.open(`${getApiBaseUrl()}/employees/bulk-upload/${activeId}/errors/stream`, '_blank');
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

    // Auto-confirm disabled to ensure user reviews validation errors

    // Reset confirming state once import is done
    React.useEffect(() => {
        if (isComplete || isFailed) {
            setIsConfirming(false);
        }
    }, [isComplete, isFailed]);

    const handleClose = () => {
        if (isProcessing) {
            onOpenChange(false);
            return;
        }

        if (data?.status === 'completed' && onSuccess) {
            onSuccess();
            onUploadIdChange?.(null);
        }

        onOpenChange(false);
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
                className="sm:max-w-[800px] w-full flex flex-col p-0 bg-card max-h-[90vh]"
            >
                <DialogHeader className="p-6 pb-2 border-b bg-muted/30 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <UserPlus className="h-6 w-6 text-primary" />
                        Bulk Employee Upload
                        {data?.status && (
                            <Badge variant="outline" className="ml-2 capitalize">
                                {data.status}
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Efficiently onboard multiple employees. Validate data formats first, then confirm import.
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
                                                <p className="text-sm text-muted-foreground">
                                                    <Badge variant="secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Badge>
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive rounded-full"
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
                                                <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="font-bold text-xl">Upload Employee CSV</p>
                                                <p className="text-sm text-muted-foreground max-w-[300px]">
                                                    Select a CSV or Excel file containing employee information.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center border shadow-sm">
                                            <Download className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Download Template</p>
                                            <p className="text-xs text-muted-foreground">Ensure columns match our system requirements.</p>
                                        </div>
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={downloadTemplate} className="font-semibold shadow-sm">
                                        Get Template
                                    </Button>
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
                                                    {isValidating ? 'Step 1: Validating Data' : data?.status === 'processing' ? 'Step 2: Importing Employees' : 'Status'}
                                                </p>
                                            </div>
                                            <h3 className="text-2xl font-black truncate max-w-[450px]">{data?.filename}</h3>
                                            <p className="text-sm text-muted-foreground italic font-medium">
                                                {data?.message || 'Processing...'}
                                            </p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-4xl font-black text-primary">{data?.progress ?? 0}</span>
                                                <span className="text-xl font-bold text-primary/70">%</span>
                                            </div>
                                            {isProcessing && (speed > 0) && (
                                                <Badge variant="secondary" className="font-mono text-[10px] py-0 px-2">
                                                    {speed} recs/sec
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <Progress value={data?.progress ?? 0} className="h-4 rounded-full" />
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-muted/40 p-4 rounded-2xl border flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total</span>
                                        <span className="text-3xl font-black">{(data?.totalRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Valid</span>
                                        <span className="text-3xl font-black text-green-600">{(data?.successRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-destructive/10 p-4 rounded-2xl border border-destructive/20 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-destructive uppercase tracking-widest mb-1">Invalid</span>
                                        <span className="text-3xl font-black text-destructive">{(data?.failedRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                    <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 flex flex-col items-center justify-center">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Processed</span>
                                        <span className="text-3xl font-black text-amber-600">{(data?.processedRecords ?? 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Results Detail */}
                                {isValidated && (
                                    <div className="p-6 rounded-2xl border-2 border-dashed bg-card space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                                <CheckCircle2 className="h-7 w-7 text-green-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-lg">Validation Finished</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    {data?.failedRecords === 0
                                                        ? "All employee records are valid and ready for import."
                                                        : `${data?.failedRecords} records have errors. They will be ignored during import.`}
                                                </p>
                                            </div>
                                        </div>

                                        {(data?.failedRecords ?? 0) > 0 && (
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setShowErrors(!showErrors)}>
                                                    {showErrors ? 'Hide Issue Details' : 'View Issue Details'}
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={downloadErrorReport} className="text-destructive">
                                                    <Download className="h-4 w-4 mr-2" /> Download Error Report
                                                </Button>
                                            </div>
                                        )}

                                        {showErrors && data?.errors && data.errors.length > 0 && (
                                            <div className="border rounded-xl overflow-hidden bg-background">
                                                <ScrollArea className="h-[250px]">
                                                    <Table>
                                                        <TableHeader className="bg-muted sticky top-0">
                                                            <TableRow>
                                                                <TableHead className="w-[60px] font-black text-[10px]">Row</TableHead>
                                                                <TableHead className="w-[120px] font-black text-[10px]">Emp ID</TableHead>
                                                                <TableHead className="font-black text-[10px]">Field</TableHead>
                                                                <TableHead className="font-black text-[10px]">Error Reason</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {data.errors.slice(0, 50).map((err: any, i) => (
                                                                <TableRow key={i}>
                                                                    <TableCell className="font-mono text-xs">{err.row}</TableCell>
                                                                    <TableCell className="font-bold text-xs">{err.employeeId || '—'}</TableCell>
                                                                    <TableCell className="text-xs font-semibold">{err.field}</TableCell>
                                                                    <TableCell className="text-xs text-destructive">{err.reason}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {data?.status === 'completed' && (
                                    <div className="space-y-4">
                                        <div className="p-8 bg-green-500/5 border-2 border-green-500/20 rounded-3xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-500">
                                            <CheckCircle2 className="h-12 w-12 text-green-600" />
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-black text-green-700">Import Complete!</h3>
                                                <p className="text-green-600/80 font-medium">
                                                    {data?.successRecords} employees have been successfully added to the system.
                                                </p>
                                            </div>
                                        </div>

                                        {(data?.failedRecords ?? 0) > 0 && (
                                            <div className="p-4 border rounded-2xl bg-muted/30 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
                                                        <AlertCircle className="h-4 w-4" />
                                                        {data.failedRecords} records were skipped due to errors
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => setShowErrors(!showErrors)} className="text-xs h-7">
                                                        {showErrors ? 'Hide Issues' : 'View Issues'}
                                                    </Button>
                                                </div>

                                                {showErrors && data?.errors && data.errors.length > 0 && (
                                                    <div className="border rounded-xl overflow-hidden bg-background">
                                                        <ScrollArea className="h-[200px]">
                                                            <Table>
                                                                <TableBody>
                                                                    {data.errors.slice(0, 50).map((err: any, i) => (
                                                                        <TableRow key={i}>
                                                                            <TableCell className="font-mono text-[10px] w-12">{err.row}</TableCell>
                                                                            <TableCell className="text-[10px] font-semibold">{err.field}</TableCell>
                                                                            <TableCell className="text-[10px] text-destructive">{err.reason}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
                    <div className="flex justify-between w-full items-center">
                        <div className="text-xs text-muted-foreground italic">
                            {isProcessing && "Processing in background. You can close this window."}
                        </div>
                        <div className="flex gap-3">
                            {!activeId ? (
                                <>
                                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                        Cancel
                                    </Button>
                                    <Button disabled={!file || isUploading} onClick={handleUpload} className="px-8 font-black">
                                        {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
                                        Start Validation
                                    </Button>
                                </>
                            ) : (
                                <>
                                    {isValidated && !isConfirming && data?.status === 'validated' && (
                                        <div className="flex gap-3">
                                            <Button variant="outline" onClick={reset}>
                                                Discard & Restart
                                            </Button>
                                            {(data?.successRecords || 0) > 0 && (
                                                <Button
                                                    onClick={handleConfirm}
                                                    className="px-10 font-black bg-green-600 hover:bg-green-700"
                                                >
                                                    <Database className="mr-2 h-4 w-4" />
                                                    Confirm Import
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    {isConfirming && (
                                        <Button disabled className="px-10 font-black">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Importing...
                                        </Button>
                                    )}
                                    {(data?.status === 'completed' || isFailed) && (
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
