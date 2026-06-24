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
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { verifyManager } from "@/lib/actions/users";
import { useAuth } from "@/components/providers/auth-provider";

interface ManagerVerificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVerified: (managerUserId?: string, note?: string) => void;
    title?: string;
    description?: string;
    requireNote?: boolean;
    notePlaceholder?: string;
}

export function ManagerVerificationDialog({
    open,
    onOpenChange,
    onVerified,
    title = "Manager Verification Required",
    description = "Enter manager credentials to authorise this restricted action.",
    requireNote = false,
    notePlaceholder = "Enter mandatory note/reason here...",
}: ManagerVerificationDialogProps) {
    const { user } = useAuth();
    const [emailOrId, setEmailOrId] = useState("");
    const [password, setPassword] = useState("");
    const [note, setNote] = useState("");
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        if (open) {
            setEmailOrId(user?.email || "");
            setPassword("");
            setNote("");
        }
    }, [open, user]);

    const handleVerify = () => {
        if (!emailOrId) {
            toast.error("Manager Login ID / Email is required");
            return;
        }
        if (!password) {
            toast.error("Password is required");
            return;
        }
        if (requireNote && !note.trim()) {
            toast.error("Mandatory note / reason is required");
            return;
        }

        startTransition(async () => {
            const result = await verifyManager(emailOrId, password);
            if (result.status && result.data) {
                toast.success("Manager credentials verified");
                onVerified(result.data.userId, note.trim());
                onOpenChange(false);
                setPassword("");
                setNote("");
            } else {
                toast.error(result.message || "Invalid credentials or unauthorized role");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isPending) { onOpenChange(o); if (!o) { setPassword(""); } } }}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-full bg-amber-500/10">
                            <ShieldCheck className="h-5 w-5 text-amber-600" />
                        </div>
                        <DialogTitle>{title}</DialogTitle>
                    </div>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="mgr-login">Manager Login ID / Email</Label>
                        <Input
                            id="mgr-login"
                            type="text"
                            value={emailOrId}
                            onChange={(e) => setEmailOrId(e.target.value)}
                            placeholder="manager@company.com or employee-ID"
                            disabled={isPending}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mgr-password">Password</Label>
                        <PasswordInput
                            id="mgr-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={isPending}
                            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                            autoFocus
                        />
                    </div>
                    {requireNote && (
                        <div className="space-y-2">
                            <Label htmlFor="mgr-note" className="flex items-center gap-1">
                                Note / Reason <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="mgr-note"
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={notePlaceholder}
                                disabled={isPending}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleVerify} disabled={isPending} className="bg-amber-600 hover:bg-amber-700">
                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Verify & Proceed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
