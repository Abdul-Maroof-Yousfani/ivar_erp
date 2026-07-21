'use client';

import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
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
    Upload,
    FileText,
    CheckCircle2,
    XCircle,
    Loader2,
    Download,
    X,
    AlertTriangle,
    FileSpreadsheet,
    RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/auth';
import { getSharedTree } from '@/components/ui/chart-of-account-select';
import { ChartOfAccount } from '@/lib/actions/chart-of-account';

function getLeafSubAccounts(node: any): any[] {
    if (!node || !node.children || node.children.length === 0) return [];
    const result: any[] = [];
    for (const child of node.children) {
        if (!child.isGroup || !child.children || child.children.length === 0) {
            result.push(child);
        } else {
            result.push(...getLeafSubAccounts(child));
        }
    }
    return result;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface MappedDetailRow {
    accountId: string;
    tagAccountId: string;
    debit: number;
    credit: number;
    narration: string;
    refBillNo: string;
    refBillNo2: string;
    taxType: 'Taxable' | 'BTL' | 'REIMB';
    taxableValue?: number; // Needed for payment voucher details
}

interface ParsedRow {
    rowIndex: number;
    lineNumber: number | string;
    accountCode: string;
    accountNameRaw?: string;
    tagCode?: string;
    tagNameRaw?: string;
    debit: number;
    credit: number;
    remarks: string;
    ref1: string;
    ref2: string;
}

type RowStatus = 'pending' | 'searching' | 'found' | 'not_found' | 'error';

interface RowResult {
    rowIndex: number;
    lineNumber: number | string;
    accountCode: string;
    accountNameRaw?: string;
    tagCode?: string;
    tagNameRaw?: string;
    debit: number;
    credit: number;
    remarks: string;
    ref1: string;
    ref2: string;
    status: RowStatus;
    resolvedAccountName?: string;
    resolvedTagName?: string;
    mappedRow?: MappedDetailRow;
    reason?: string;
}

type Phase = 'select' | 'running' | 'done';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImportComplete: (details: MappedDetailRow[]) => void;
    voucherType: 'journal' | 'payment' | 'receipt';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanNumber(val: any): number {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim().replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function flattenTree(nodes: ChartOfAccount[]): ChartOfAccount[] {
    const result: ChartOfAccount[] = [];
    function walk(list: ChartOfAccount[]) {
        for (const node of list) {
            result.push(node);
            if (node.children?.length) walk(node.children);
        }
    }
    walk(nodes);
    return result;
}

async function ensureCoaTree(): Promise<ChartOfAccount[]> {
    const shared = getSharedTree();
    if (shared && shared.length > 0) return shared;

    try {
        const res = await authFetch('/finance/chart-of-accounts/tree', {});
        const data = res.data;
        const tree: ChartOfAccount[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
                ? data.data
                : [];
        return tree;
    } catch (err) {
        console.error('Failed to load COA tree for import', err);
        return [];
    }
}

// ─── File Parsing ─────────────────────────────────────────────────────────────

function parseFile(file: File): Promise<ParsedRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                // Normalise header names (case-insensitive, strip spaces and symbols)
                const normalise = (k: string) => k.toLowerCase().replace(/[\s_\-\#]/g, '');

                const rows: ParsedRow[] = [];
                jsonRows.forEach((raw, idx) => {
                    const keys = Object.keys(raw);

                    const lineKey = keys.find((k) => ['linenumber', 'line', 'sr', 'no', 'serial'].includes(normalise(k)));
                    const accKey = keys.find((k) => ['fkaccountcode', 'accountcode', 'acccode', 'code', 'account'].includes(normalise(k)));
                    const accNameKey = keys.find((k) => ['accountname', 'name', 'accname'].includes(normalise(k)));
                    const tagKey = keys.find((k) => ['tagid', 'tag', 'subaccountcode', 'subaccount'].includes(normalise(k)));
                    const tagNameKey = keys.find((k) => ['subaccountname', 'tagname', 'subname'].includes(normalise(k)));
                    const debitKey = keys.find((k) => ['debit', 'dr', 'debitamount'].includes(normalise(k)));
                    const creditKey = keys.find((k) => ['credit', 'cr', 'creditamount'].includes(normalise(k)));
                    const remarksKey = keys.find((k) => ['remarks', 'remarks', 'narration', 'remark', 'desc', 'description'].includes(normalise(k)));
                    const ref1Key = keys.find((k) => ['ref1', 'refbillno', 'ref', 'billno', 'bill'].includes(normalise(k)));
                    const ref2Key = keys.find((k) => ['ref2', 'refbillno2', 'refbill2', 'billno2', 'bill2'].includes(normalise(k)));

                    const lineNumber = lineKey ? String(raw[lineKey]).trim() : idx + 1;
                    const accountCode = accKey ? String(raw[accKey]).trim() : '';
                    const accountNameRaw = accNameKey ? String(raw[accNameKey]).trim() : undefined;
                    const tagCode = tagKey ? String(raw[tagKey]).trim() : '';
                    const tagNameRaw = tagNameKey ? String(raw[tagNameKey]).trim() : undefined;
                    const debit = debitKey ? cleanNumber(raw[debitKey]) : 0;
                    const credit = creditKey ? cleanNumber(raw[creditKey]) : 0;
                    const remarks = remarksKey ? String(raw[remarksKey]).trim() : '';
                    const ref1 = ref1Key ? String(raw[ref1Key]).trim() : '';
                    const ref2 = ref2Key ? String(raw[ref2Key]).trim() : '';

                    if (accountCode) {
                        rows.push({
                            rowIndex: idx + 2, // 1-based + header row
                            lineNumber,
                            accountCode,
                            accountNameRaw,
                            tagCode,
                            tagNameRaw,
                            debit,
                            credit,
                            remarks,
                            ref1,
                            ref2,
                        });
                    }
                });

                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoucherImportModal({ open, onOpenChange, onImportComplete, voucherType }: Props) {
    const [phase, setPhase] = useState<Phase>('select');
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<RowResult[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef(false);
    const scrollBottomRef = useRef<HTMLDivElement>(null);

    // ── Derived ──────────────────────────────────────────────────────────────

    const total = rows.length;
    const processed = rows.filter((r) => r.status !== 'pending' && r.status !== 'searching').length;
    const found = rows.filter((r) => r.status === 'found').length;
    const errors = rows.filter((r) => r.status === 'error' || r.status === 'not_found').length;
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    const isRunning = phase === 'running';
    const isDone = phase === 'done';

    // ── File handling ─────────────────────────────────────────────────────────

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

    // ── Run Import & Resolution ──

    const handleStart = useCallback(async () => {
        if (!file) return;
        abortRef.current = false;

        let parsed: ParsedRow[];
        try {
            parsed = await parseFile(file);
        } catch {
            toast.error('Failed to parse file. Check the file format.');
            return;
        }

        if (parsed.length === 0) {
            toast.error('No valid rows found. Ensure the file has an Account Code column.');
            return;
        }

        // Initialize rows with pending status
        const initRows: RowResult[] = parsed.map((r) => ({
            ...r,
            status: 'pending',
        }));

        setRows(initRows);
        setCurrentIndex(0);
        setPhase('running');

        // Fetch COA tree
        const coaTree = await ensureCoaTree();
        if (coaTree.length === 0) {
            toast.error('Could not load Chart of Accounts. Please make sure you are signed in.');
            setPhase('done');
            return;
        }

        const flatAccounts = flattenTree(coaTree);
        const results: RowResult[] = [...initRows];

        // Process row-by-row for beautiful visual feedback
        for (let i = 0; i < parsed.length; i++) {
            if (abortRef.current) break;

            results[i] = { ...results[i], status: 'searching' };
            setRows([...results]);
            setCurrentIndex(i);

            const parsedRow = parsed[i];
            const accountCodeStr = parsedRow.accountCode.trim();
            const tagCodeStr = parsedRow.tagCode?.trim() || '';

            // 1. Locate account by code
            const foundAccount = flatAccounts.find((acc) => acc.code === accountCodeStr);

            if (!foundAccount) {
                results[i] = {
                    ...results[i],
                    status: 'not_found',
                    reason: `Account code '${accountCodeStr}' not found in COA.`,
                };
            } else {
                // Account found! Let's check sub-account (tag) code if specified
                let tagAccountId = '';
                let resolvedTagName = '';
                let hasTagError = false;
                let tagErrorReason = '';

                if (tagCodeStr) {
                    const tagSubAccounts = getLeafSubAccounts(foundAccount);
                    const foundTag = tagSubAccounts.find((child: any) => child.code === tagCodeStr || child.id === tagCodeStr);
                    if (foundTag) {
                        tagAccountId = foundTag.id;
                        resolvedTagName = foundTag.name;
                    } else {
                        hasTagError = true;
                        tagErrorReason = `Sub-account code '${tagCodeStr}' not found under account '${foundAccount.code} - ${foundAccount.name}'.`;
                    }
                }

                // 2. Validate debits & credits
                const debit = parsedRow.debit;
                const credit = parsedRow.credit;
                let hasAmountError = false;
                let amountErrorReason = '';

                if (debit === 0 && credit === 0) {
                    hasAmountError = true;
                    amountErrorReason = 'Both Debit and Credit cannot be zero or empty.';
                } else if (debit > 0 && credit > 0) {
                    hasAmountError = true;
                    amountErrorReason = 'A single row cannot have both Debit and Credit amounts.';
                } else if (debit < 0 || credit < 0) {
                    hasAmountError = true;
                    amountErrorReason = 'Debit or Credit amounts cannot be negative.';
                }

                if (hasTagError) {
                    results[i] = {
                        ...results[i],
                        status: 'error',
                        resolvedAccountName: foundAccount.name,
                        reason: tagErrorReason,
                    };
                } else if (hasAmountError) {
                    results[i] = {
                        ...results[i],
                        status: 'error',
                        resolvedAccountName: foundAccount.name,
                        resolvedTagName,
                        reason: amountErrorReason,
                    };
                } else {
                    // All validated! Map to target form row format
                    const mappedRow: MappedDetailRow = {
                        accountId: foundAccount.id,
                        tagAccountId,
                        debit,
                        credit,
                        narration: parsedRow.remarks,
                        refBillNo: parsedRow.ref1,
                        refBillNo2: parsedRow.ref2,
                        taxType: 'Taxable',
                    };

                    if (voucherType === 'payment') {
                        mappedRow.taxableValue = 0;
                    }

                    results[i] = {
                        ...results[i],
                        status: 'found',
                        resolvedAccountName: foundAccount.name,
                        resolvedTagName,
                        mappedRow,
                    };
                }
            }

            setRows([...results]);

            // Scroll preview table
            setTimeout(() => {
                scrollBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 30);

            // Small delay for smooth UI feedback
            await new Promise((res) => setTimeout(res, 15));
        }

        setPhase('done');

        const matched = results.filter((r) => r.status === 'found');
        if (matched.length === 0) {
            toast.error('No rows could be successfully resolved. Check account codes and amounts.');
        } else {
            toast.success(`${matched.length} row(s) matched successfully and ready to import.`);
        }
    }, [file, voucherType]);

    // ── Abort ─────────────────────────────────────────────────────────────────

    const handleAbort = () => {
        abortRef.current = true;
        setPhase('done');
        toast.info('Import aborted.');
    };

    // ── Confirm Import ────────────────────────────────────────────────────────

    const handleConfirm = () => {
        const matched = rows.filter((r) => r.status === 'found');
        if (matched.length === 0) {
            toast.error('No matched rows to import.');
            return;
        }

        const details: MappedDetailRow[] = matched.map((r) => r.mappedRow!);
        onImportComplete(details);
        onOpenChange(false);
        reset();
    };

    // ── Download error report ──

    const handleDownloadErrorReport = () => {
        const errorsList = rows.filter((r) => r.status === 'not_found' || r.status === 'error');
        if (errorsList.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(
            errorsList.map((r) => ({
                RowIndex: r.rowIndex,
                LineNumber: r.lineNumber,
                FKAccountCode: r.accountCode,
                AccountName: r.accountNameRaw ?? '',
                TagID: r.tagCode ?? '',
                SubAccountName: r.tagNameRaw ?? '',
                Debit: r.debit,
                Credit: r.credit,
                Remarks: r.remarks,
                Ref1: r.ref1,
                Ref2: r.ref2,
                Reason: r.reason || 'Invalid',
            }))
        );
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Errors');
        XLSX.writeFile(wb, `${voucherType}_voucher_import_errors.xlsx`);
    };

    // ── Reset ──

    const reset = () => {
        setFile(null);
        setRows([]);
        setCurrentIndex(0);
        setPhase('select');
        abortRef.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        if (isRunning) {
            handleAbort();
        }
        onOpenChange(false);
        setTimeout(reset, 300);
    };

    // ── Status badge ──

    const statusBadge = (status: RowStatus) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold text-muted-foreground">Pending</Badge>;
            case 'searching':
                return <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold text-blue-500 border-blue-300 bg-blue-50 dark:bg-blue-950/30 animate-pulse">Checking…</Badge>;
            case 'found':
                return <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">OK</Badge>;
            case 'not_found':
                return <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold text-destructive border-destructive/30 bg-destructive/5">Not Found</Badge>;
            case 'error':
                return <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">Error</Badge>;
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent
                showCloseButton={false}
                noScroll
                onInteractOutside={(e) => { if (isRunning) e.preventDefault(); }}
                className="sm:max-w-[900px] w-full flex flex-col p-0 bg-card max-h-[95vh]"
            >
                {/* Header */}
                <DialogHeader className="p-6 pb-3 border-b bg-muted/30 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Import Voucher Details from Excel / CSV
                        {phase !== 'select' && (
                            <Badge variant="outline" className="ml-2 capitalize text-xs">
                                {phase === 'running' ? 'Processing…' : 'Done'}
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Upload a CSV or Excel spreadsheet containing your accounting entries. Account codes and sub-accounts will be automatically validated against the COA.
                    </DialogDescription>
                </DialogHeader>

                {/* Body */}
                <ScrollArea className="flex-1 w-full overflow-y-auto">
                    <div className="p-6 space-y-5">
                        {phase === 'select' && (
                            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-400">
                                {/* Drop zone */}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 group',
                                        file
                                            ? 'border-primary/50 bg-primary/5'
                                            : 'border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/50'
                                    )}
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
                                            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                                                <FileText className="h-8 w-8 text-primary" />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <p className="font-bold text-lg">{file.name}</p>
                                                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                                    <Badge variant="secondary" className="font-mono">{(file.size / 1024).toFixed(1)} KB</Badge>
                                                    Ready to import
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
                                                <X className="h-4 w-4 mr-1" /> Change File
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="font-bold text-lg">Click to select CSV or Excel file</p>
                                                <p className="text-sm text-muted-foreground max-w-lg">
                                                    Spreadsheet should have headers: <span className="font-mono font-bold">FKAccountCode</span>, <span className="font-mono font-bold">Debit</span>, <span className="font-mono font-bold">Credit</span>, and optional <span className="font-mono font-bold">TagID</span>, <span className="font-mono font-bold">Remarks</span>, <span className="font-mono font-bold">Ref 1</span>, <span className="font-mono font-bold">Ref 2</span>.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                {['.CSV', '.XLSX', '.XLS'].map((ext) => (
                                                    <Badge key={ext} variant="outline" className="bg-background/50 font-mono">{ext}</Badge>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Columns Mapping Guide */}
                                <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Expected Spreadsheet Headers Mapping</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                                        <div className="space-y-1">
                                            <span className="font-bold text-foreground block">Account Info</span>
                                            <span className="text-[11px] text-muted-foreground block">Required head code & optional sub-account:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {['FKAccountCode', 'TagID'].map(h => (
                                                    <Badge key={h} variant="secondary" className="text-[10px] py-0 px-1 font-mono font-normal">{h}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1 border-x px-2">
                                            <span className="font-bold text-foreground block">Amounts</span>
                                            <span className="text-[11px] text-muted-foreground block">One amount column must have value &gt; 0:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {['Debit', 'Credit'].map(h => (
                                                    <Badge key={h} variant="secondary" className="text-[10px] py-0 px-1 font-mono font-normal">{h}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1 pl-2">
                                            <span className="font-bold text-foreground block">References & Remarks</span>
                                            <span className="text-[11px] text-muted-foreground block">Maps to line Narration and Bill No:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {['Remarks', 'Ref 1', 'Ref 2'].map(h => (
                                                    <Badge key={h} variant="secondary" className="text-[10px] py-0 px-1 font-mono font-normal">{h}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Running / Completed Phase */}
                        {(phase === 'running' || phase === 'done') && (
                            <div className="space-y-5 animate-in fade-in duration-400">
                                {/* Progress section */}
                                <div className="space-y-2.5">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                                {isDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                <p className="text-xs font-black text-primary uppercase tracking-widest">
                                                    {isRunning ? `Resolving row ${currentIndex + 1} of ${total}…` : 'Validation complete'}
                                                </p>
                                            </div>
                                            <p className="text-base font-bold truncate max-w-[480px] text-foreground">{file?.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-3xl font-black text-primary">{progress}</span>
                                                <span className="text-lg font-bold text-primary/70">%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Progress value={progress} className="h-2.5 rounded-full" />
                                </div>

                                {/* Stats Cards */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-muted/40 p-3.5 rounded-xl border flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Rows</span>
                                        <span className="text-2xl font-black">{total}</span>
                                    </div>
                                    <div className="bg-blue-500/10 p-3.5 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Processed</span>
                                        <span className="text-2xl font-black text-blue-600">{processed}</span>
                                    </div>
                                    <div className="bg-green-500/10 p-3.5 rounded-xl border border-green-500/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Valid Rows</span>
                                        <span className="text-2xl font-black text-green-600">{found}</span>
                                    </div>
                                    <div className="bg-destructive/10 p-3.5 rounded-xl border border-destructive/20 flex flex-col items-center justify-center shadow-sm">
                                        <span className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">Invalid</span>
                                        <span className="text-2xl font-black text-destructive">{errors}</span>
                                    </div>
                                </div>

                                {/* Preview table */}
                                <div className="border rounded-xl overflow-hidden shadow-sm bg-background/50">
                                    <div className="px-4 py-2 bg-muted/40 border-b flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Row Resolution Status
                                        </span>
                                        {isDone && errors > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleDownloadErrorReport}
                                                className="h-7 text-xs font-bold text-destructive hover:bg-destructive/5"
                                            >
                                                <Download className="h-3.5 w-3.5 mr-1.5" />
                                                Download Error Report
                                            </Button>
                                        )}
                                    </div>
                                    <ScrollArea className="h-[280px]">
                                        <Table>
                                            <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead className="w-[50px] font-bold uppercase text-[10px]">Row</TableHead>
                                                    <TableHead className="font-bold uppercase text-[10px]">Account Code</TableHead>
                                                    <TableHead className="font-bold uppercase text-[10px]">Sub-Account (Tag)</TableHead>
                                                    <TableHead className="font-bold uppercase text-[10px] text-right">Debit</TableHead>
                                                    <TableHead className="font-bold uppercase text-[10px] text-right">Credit</TableHead>
                                                    <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                                                    <TableHead className="font-bold uppercase text-[10px]">Validation Note</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {rows.map((row, idx) => (
                                                    <TableRow
                                                        key={idx}
                                                        className={cn(
                                                            'transition-colors',
                                                            row.status === 'found' && 'bg-green-500/5',
                                                            (row.status === 'not_found' || row.status === 'error') && 'bg-destructive/5',
                                                            row.status === 'searching' && 'bg-blue-500/5',
                                                        )}
                                                    >
                                                        <TableCell className="font-mono text-xs font-bold text-muted-foreground">{row.rowIndex}</TableCell>
                                                        <TableCell className="text-xs">
                                                            <div className="font-mono font-semibold">{row.accountCode}</div>
                                                            {row.resolvedAccountName && (
                                                                <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{row.resolvedAccountName}</div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {row.tagCode ? (
                                                                <>
                                                                    <div className="font-mono font-semibold">{row.tagCode}</div>
                                                                    {row.resolvedTagName && (
                                                                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{row.resolvedTagName}</div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-muted-foreground">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-mono font-semibold text-right text-foreground">
                                                            {row.debit > 0 ? row.debit.toLocaleString() : '—'}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-mono font-semibold text-right text-foreground">
                                                            {row.credit > 0 ? row.credit.toLocaleString() : '—'}
                                                        </TableCell>
                                                        <TableCell>{statusBadge(row.status)}</TableCell>
                                                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                            {row.reason || (row.status === 'found' && 'Valid entry line')}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                <tr>
                                                    <td><div ref={scrollBottomRef} /></td>
                                                </tr>
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>

                                {/* Done summary */}
                                {isDone && found > 0 && (
                                    <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center gap-3 animate-in zoom-in-95 duration-400">
                                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-green-700">{found} row(s) matched successfully</p>
                                            <p className="text-xs text-green-600/80">
                                                Ready to import. Click <strong>Import Rows</strong> to populate the details table of the voucher.
                                                {errors > 0 && ` (${errors} invalid row(s) will be ignored.)`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {isDone && found === 0 && (
                                    <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl flex items-center gap-3 animate-in zoom-in-95 duration-400">
                                        <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                                            <XCircle className="h-6 w-6 text-destructive" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-destructive">No rows matched successfully</p>
                                            <p className="text-xs text-destructive/80">
                                                None of the rows in the spreadsheet could be matched against the Chart of Accounts. Check your account codes and try again.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <DialogFooter className="p-5 border-t bg-muted/30 shrink-0">
                    <div className="flex justify-between w-full items-center">
                        <div>
                            {isRunning && (
                                <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Resolving accounts against COA…
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {phase === 'select' && (
                                <>
                                    <Button variant="ghost" onClick={handleClose} className="font-bold">Cancel</Button>
                                    <Button
                                        disabled={!file}
                                        onClick={handleStart}
                                        className="px-8 font-black shadow-lg shadow-primary/20"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Start Validation
                                    </Button>
                                </>
                            )}

                            {isRunning && (
                                <Button variant="destructive" onClick={handleAbort} className="font-bold">
                                    <X className="h-4 w-4 mr-2" /> Abort
                                </Button>
                            )}

                            {isDone && (
                                <>
                                    <Button variant="outline" onClick={reset} className="font-bold">
                                        <RefreshCcw className="h-4 w-4 mr-2" /> Re-upload
                                    </Button>
                                    <Button
                                        onClick={handleConfirm}
                                        disabled={found === 0}
                                        className="px-8 font-black bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Import Rows ({found} lines)
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
