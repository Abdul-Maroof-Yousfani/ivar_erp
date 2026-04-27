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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { verifyPassword } from "@/lib/actions/users";

interface AdminVerificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVerified: () => void;
    title?: string;
    description?: string;
}

export function AdminVerificationDialog({
    open,
    onOpenChange,
    onVerified,
    title = "Admin Verification Required",
    description = "Please enter your account password to proceed with this restricted action.",
}: AdminVerificationDialogProps) {
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
                toast.success("Verification successful");
                onVerified();
                onOpenChange(false);
                setPassword("");
            } else {
                toast.error(result.message || "Invalid password");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-full bg-primary/10">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle>{title}</DialogTitle>
                    </div>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="admin-password">Your Password</Label>
                        <Input
                            id="admin-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={isPending}
                            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleVerify} disabled={isPending}>
                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Verify & Proceed
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
