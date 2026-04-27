"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Terminal, AlertTriangle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/utils";
import { PermissionGuard } from "@/components/auth/permission-guard";

async function deregisterTerminal(): Promise<boolean> {
    try {
        const res = await fetch(`${getApiBaseUrl()}/auth/pos/logout-terminal`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export default function LogoutTerminalPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleDeregister = async () => {
        setIsLoading(true);
        const ok = await deregisterTerminal();
        if (ok) {
            toast.success("Terminal deregistered");
            // Redirect to terminal setup / pos-login so the device can be re-registered
            router.replace("/auth/pos-login");
        } else {
            toast.error("Failed to deregister terminal");
            setIsLoading(false);
        }
    };

    return (
        <PermissionGuard permissions="pos.terminal.logout">
        <div className="min-h-screen font-inter">
            <div className="max-w-lg mx-auto pt-6 px-4">
                {/* Header */}
                <div className="bg-card rounded-[32px] p-4 flex items-center gap-3 shadow-sm border border-border mb-6">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}
                        className="text-muted-foreground hover:bg-accent rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Logout Terminal</h1>
                        <p className="text-sm text-muted-foreground">Deregister this device as a POS terminal</p>
                    </div>
                </div>

                {/* Warning card */}
                <div className="bg-card rounded-[32px] p-8 shadow-sm border border-border space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-destructive/10 p-3 rounded-2xl shrink-0">
                            <Terminal className="w-6 h-6 text-destructive" />
                        </div>
                        <div>
                            <p className="font-semibold text-lg">This will deregister the terminal</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                The <code className="text-xs bg-muted px-1.5 py-0.5 rounded">posTerminalToken</code> cookie
                                will be cleared from this device. To use this screen as a POS terminal again,
                                you'll need to re-enter the terminal code and PIN.
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                            <p className="font-medium">Before you continue:</p>
                            <ul className="list-disc list-inside space-y-0.5 text-xs">
                                <li>Make sure any open shift is closed</li>
                                <li>All pending sales are completed or held</li>
                                <li>You have the terminal PIN to re-register</li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" onClick={() => router.back()}
                            className="flex-1 rounded-full" disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeregister}
                            disabled={isLoading}
                            className="flex-1 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            {isLoading ? "Deregistering..." : "Deregister Terminal"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        </PermissionGuard>
    );
}
