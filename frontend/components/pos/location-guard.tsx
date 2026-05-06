"use client";

import { AlertTriangle, MapPin, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";

export function LocationGuard({ children }: { children: React.ReactNode }) {
    const { user, isAdmin, logout } = useAuth();
    const router = useRouter();

    // If there is no user, or they don't have a terminal, allow other components to handle it
    if (!user || !user.terminalId) {
        return <>{children}</>;
    }

    // Admins can use POS anywhere
    if (isAdmin()) {
        return <>{children}</>;
    }

    const userLocationId = user.locationId;
    const terminalLocationId = user.terminal?.location?.id;

    // If they have no restricted location, or it matches the terminal, they are allowed
    if (!userLocationId || userLocationId === terminalLocationId) {
        return <>{children}</>;
    }

    const handleSwitchUser = async () => {
        // Logout will clear the user's accessToken but preserve the terminal token.
        // The user will automatically route to /auth/choose-account or /pos/user-login depending on their path
        await logout();
    };

    return (
        <div className="relative w-full h-full min-h-screen">
            {/* The actual page underneath, blurred out and non-interactive */}
            <div className="absolute inset-0 pointer-events-none blur-sm opacity-50 select-none overflow-hidden">
                {children}
            </div>

            {/* The rigid, un-closeable alert overlay */}
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
                <Card className="w-full max-w-lg shadow-2xl border-destructive/20 border-2">
                    <CardHeader className="text-center pb-4 space-y-3">
                        <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-destructive/20 shadow-inner">
                            <AlertTriangle className="h-8 w-8 text-destructive animate-pulse" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-destructive">
                            Access Denied
                        </CardTitle>
                        <p className="text-base font-medium text-muted-foreground">
                            You do not have access to this location.
                        </p>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
                            <div className="flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-emerald-600" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Terminal Location</span>
                                    <span className="text-sm font-semibold">{user.terminal?.location?.name || "Unknown"}</span>
                                </div>
                            </div>
                            <div className="h-px bg-border w-full" />
                            <div className="flex items-center gap-3">
                                <UserRoundX className="h-5 w-5 text-destructive" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Assigned Location</span>
                                    <span className="text-sm font-semibold text-destructive">Different from terminal</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-center text-muted-foreground">
                            Please login at your own location or sign in as an authorized user for this terminal.
                        </p>

                        <Button
                            variant="default"
                            className="w-full h-12 font-bold text-base bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            onClick={handleSwitchUser}
                        >
                            SWITCH USER
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
