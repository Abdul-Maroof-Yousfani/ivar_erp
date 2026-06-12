"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserCheck, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ImpersonationBannerProps {
    employeeName?: string;
}

export function ImpersonationBanner({ employeeName }: ImpersonationBannerProps) {
    const [stopping, setStopping] = useState(false);
    const router = useRouter();

    const handleStopImpersonating = async () => {
        setStopping(true);
        try {
            const apiBase =
                process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

            const res = await fetch(`${apiBase}/auth/stop-impersonating`, {
                method: "POST",
                credentials: "include",
            });

            const payload = await res.json();

            if (res.ok && payload.status) {
                toast.success("Returned to your admin session");
                // Give cookies time to settle before redirecting
                setTimeout(() => {
                    router.push("/hr/employee/user-account");
                    window.location.reload();
                }, 300);
            } else {
                toast.error(payload.message || "Failed to stop impersonating");
            }
        } catch (error) {
            console.error("Error stopping impersonation:", error);
            toast.error("Failed to return to admin session");
        } finally {
            setStopping(false);
        }
    };

    return (
        <div className="bg-purple-600 text-white text-center font-medium shrink-0 h-10 z-60 flex items-center justify-center gap-4 shadow-md border-b border-purple-700 fixed top-0 left-0 right-0">
            <UserCheck className="h-4 w-4 text-white" />
            <span className="text-xs tracking-wide">
                VIEWING AS:{" "}
                <strong>{employeeName || "EMPLOYEE"}</strong> — You are currently impersonating this user
            </span>
            <Button
                variant="secondary"
                size="sm"
                className="h-6 px-3 text-xs bg-white text-purple-600 hover:bg-purple-50 hover:text-purple-700 font-semibold border-0"
                onClick={handleStopImpersonating}
                disabled={stopping}
            >
                {stopping ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                    <LogOut className="h-3 w-3 mr-1" />
                )}
                {stopping ? "Returning..." : "Return to Admin"}
            </Button>
        </div>
    );
}
