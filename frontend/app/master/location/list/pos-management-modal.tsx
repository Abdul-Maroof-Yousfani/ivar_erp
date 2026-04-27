"use client";

import { useState, useTransition, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getPosByLocation, updatePos, createPos, Pos } from "@/lib/actions/pos";
import { AdminVerificationDialog } from "@/components/auth/admin-verification-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Loader2, Monitor, Plus, Power, PowerOff, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

interface ManagePosModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: string;
    locationName: string;
}

export function ManagePosModal({
    open,
    onOpenChange,
    locationId,
    locationName,
}: ManagePosModalProps) {
    const [posList, setPosList] = useState<Pos[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [verificationOpen, setVerificationOpen] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'status' | 'pin' | 'create';
        id: string;
        targetStatus?: string;
    } | null>(null);

    // For PIN reset and New POS
    const [newPin, setNewPin] = useState("");
    const [newName, setNewName] = useState("");
    const [newTerminalCode, setNewTerminalCode] = useState("");

    const { hasPermission } = useAuth();
    const canCreate = hasPermission("master.pos.create");
    const canUpdate = hasPermission("master.pos.update");

    const fetchPos = async () => {
        setIsLoading(true);
        const result = await getPosByLocation(locationId);
        if (result.status && result.data) {
            setPosList(result.data);
        } else {
            toast.error(result.message || "Failed to fetch POS terminals");
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (open && locationId) {
            fetchPos();
            setShowAddForm(false);
        }
    }, [open, locationId]);

    const handleActionClick = (type: 'status' | 'pin' | 'create', id: string, targetStatus?: string) => {
        if (type === 'create') {
            if (!newName) {
                toast.error("Please enter a terminal name");
                return;
            }
            if (!newPin || newPin.length !== 4) {
                toast.error("Please enter a 4-digit PIN");
                return;
            }
        }
        if (type === 'pin') {
            if (!newPin || newPin.length !== 4) {
                toast.error("Please enter a 4-digit PIN");
                return;
            }
        }
        setPendingAction({ type, id, targetStatus });
        setVerificationOpen(true);
    };

    const executeAction = () => {
        if (!pendingAction) return;

        startTransition(async () => {
            let result;
            if (pendingAction.type === 'status') {
                result = await updatePos(pendingAction.id, {
                    status: pendingAction.targetStatus,
                });
            } else if (pendingAction.type === 'pin') {
                result = await updatePos(pendingAction.id, {
                    terminalPin: newPin,
                });
                setNewPin("");
            } else if (pendingAction.type === 'create') {
                result = await createPos({
                    name: newName,
                    locationId,
                    terminalPin: newPin,
                    status: 'active',
                    terminalCode: newTerminalCode || undefined
                });
                if (result.status) {
                    setNewName("");
                    setNewPin("");
                    setNewTerminalCode("");
                    setShowAddForm(false);
                }
            }

            if (result?.status) {
                toast.success(result.message);
                fetchPos();
                setPendingAction(null);
            } else {
                toast.error(result?.message || "Action failed");
            }
        });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange} >
                <DialogContent showCloseButton={false} >
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Manage POS: {locationName}
                            </div>
                            {canCreate && (
                                <Button
                                    size="sm"
                                    variant={showAddForm ? "ghost" : "default"}
                                    className="h-8 gap-1 transition-all"
                                    onClick={() => setShowAddForm(!showAddForm)}
                                >
                                    {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {showAddForm ? "Cancel" : "Add Terminal"}
                                </Button>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Oversee POS terminals for this location. Restricted actions require admin verification.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4 pr-2 -mr-2">
                        {showAddForm && (
                            <div className="mb-6 p-4 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
                                    <Plus className="h-4 w-4" />
                                    New POS Terminal
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-pos-name">Terminal Name</Label>
                                        <Input
                                            id="new-pos-name"
                                            placeholder="e.g. Counter 1"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="bg-background"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-pos-code">Code (Optional)</Label>
                                        <Input
                                            id="new-pos-code"
                                            placeholder="e.g. MAIN-01"
                                            value={newTerminalCode}
                                            onChange={(e) => setNewTerminalCode(e.target.value.toUpperCase())}
                                            className="bg-background font-mono uppercase"
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="new-pos-pin">Set 4-Digit PIN</Label>
                                        <Input
                                            id="new-pos-pin"
                                            placeholder="e.g. 1234"
                                            maxLength={4}
                                            value={newPin}
                                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                            className="bg-background font-mono"
                                        />
                                        <p className="text-[10px] text-muted-foreground">Used for terminal login authentication.</p>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button size="sm" onClick={() => handleActionClick('create', 'new')} disabled={isPending}>
                                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                                        Verify & Create
                                    </Button>
                                </div>
                            </div>
                        )}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                                <p className="text-sm text-muted-foreground mt-2">Loading terminals...</p>
                            </div>
                        ) : posList.length === 0 ? (
                            <div className="text-center py-12 bg-secondary/20 rounded-lg border-2 border-dashed">
                                <p className="text-muted-foreground">No POS terminals assigned to this location.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {posList.map((pos) => (
                                    <div key={pos.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-sm transition-all">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg tracking-tight">{pos.terminalCode || pos.posId}</span>
                                                <Badge variant={pos.status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-4">
                                                    {pos.status}
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{pos.name} ({pos.posId})</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {canUpdate && (
                                            <>
                                            <div className="flex flex-col gap-2">
                                                {pendingAction?.type === 'pin' && pendingAction.id === pos.id ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                        <Input
                                                            placeholder="4-digit PIN"
                                                            className="w-24 h-8 text-xs font-mono"
                                                            maxLength={4}
                                                            value={newPin}
                                                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8 text-[10px]"
                                                            onClick={() => handleActionClick('pin', pos.id)}
                                                            disabled={isPending}
                                                        >
                                                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => { setPendingAction(null); setNewPin(""); }}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-[10px] gap-1.5"
                                                        onClick={() => setPendingAction({ type: 'pin', id: pos.id })}
                                                    >
                                                        <Key className="h-3 w-3" />
                                                        Reset PIN
                                                    </Button>
                                                )}
                                            </div>

                                            <Button
                                                variant={pos.status === 'active' ? "destructive" : "default"}
                                                size="sm"
                                                className="h-8 text-[10px] gap-1.5 min-w-[100px]"
                                                onClick={() => handleActionClick('status', pos.id, pos.status === 'active' ? 'inactive' : 'active')}
                                                disabled={isPending && pendingAction?.id === pos.id}
                                            >
                                                {pos.status === 'active' ? (
                                                    <>
                                                        <PowerOff className="h-3 w-3" />
                                                        Deactivate
                                                    </>
                                                ) : (
                                                    <>
                                                        <Power className="h-3 w-3" />
                                                        Activate
                                                    </>
                                                )}
                                            </Button>
                                            </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AdminVerificationDialog
                open={verificationOpen}
                onOpenChange={setVerificationOpen}
                onVerified={executeAction}
                description={
                    pendingAction?.type === 'status'
                        ? `Are you sure you want to ${pendingAction.targetStatus === 'active' ? 'activate' : 'deactivate'} this POS terminal?`
                        : "Please verify your password to reset the terminal PIN."
                }
            />
        </>
    );
}
