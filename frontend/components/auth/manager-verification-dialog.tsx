"use client";

import { useState, useTransition } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { verifyPassword } from "@/lib/actions/users";

interface ManagerVerificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVerified: () => void;
    title?: string;
    description?: string;
}

export function ManagerVerificationDialog({
    open,
    onOpenChange,
    onVerified,
    title = "Manager Verification Required",
    description = "Enter your password to authorise this restricted action.",
}: ManagerVerificationDialogProps) {
    const [password, setPassword] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleVerify = () => {
        if (!password) {
            toast.error("Password is required");
            return;
        }

        startTransition(async () => {
            const result = await verifyPassword(password);
            if (result.status) {
                toast.success("Verified");
                onVerified();
                onOpenChange(false);
                setPassword("");
            } else {
                toast.error(result.message || "Invalid password");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isPending) { onOpenChange(o); if (!o) setPassword(""); } }}>
            <DialogContent className="sm:max-w-100">
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
                        <Label htmlFor="mgr-password">Your Password</Label>
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
