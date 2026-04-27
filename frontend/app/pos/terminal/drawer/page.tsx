"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Cash Drawer page — redirects to the unified Shifts page.
 * Drawer management (open float, close session, history) is now
 * handled at /pos/shifts to keep everything in one place.
 */
export default function DrawerRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/pos/shifts");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Redirecting to Shifts...</p>
        </div>
    );
}
