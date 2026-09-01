"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth";

export default function CurrentSessionRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        const fetchCurrentSession = async () => {
            try {
                const res = await authFetch("/pos-session/current");
                if (res.ok && res.data) {
                    const sessionId = res.data.session?.id || res.data.id;
                    if (sessionId) {
                        router.replace(`/pos/session/${sessionId}`);
                        return;
                    }
                }
                toast.error("No active session found");
                router.replace("/pos/shifts");
            } catch (err) {
                console.error("Failed to load current session", err);
                toast.error("Error loading current session");
                router.replace("/pos/shifts");
            }
        };

        fetchCurrentSession();
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center font-inter text-center p-6">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold">Locating Active Session</h2>
            <p className="text-muted-foreground">Redirecting to your current session details...</p>
        </div>
    );
}
