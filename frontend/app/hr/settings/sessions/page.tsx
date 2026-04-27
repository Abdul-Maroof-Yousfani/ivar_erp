"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Laptop, Smartphone, Globe, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { authFetch } from "@/lib/auth";

interface Session {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    deviceInfo: string | null;
    deviceType: string | null;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    isCurrent?: boolean;
}

export default function SessionsPage() {
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [terminatingId, setTerminatingId] = useState<string | null>(null);
    const [sessionToTerminate, setSessionToTerminate] = useState<Session | null>(null);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await authFetch("/auth/sessions");
            const { data } = res;

            if (data.status && Array.isArray(data.data)) {
                setSessions(data.data);
            }
        } catch (error) {
            toast.error("Failed to load sessions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleTerminate = async () => {
        if (!sessionToTerminate) return;

        try {
            setTerminatingId(sessionToTerminate.id);
            const res = await authFetch("/auth/sessions/terminate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId: sessionToTerminate.id }),
            });

            const { data } = res;

            if (data.status) {
                toast.success("Session terminated successfully");
                setSessions(sessions.filter(s => s.id !== sessionToTerminate.id));
            } else {
                toast.error(data.message || "Failed to terminate session");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setTerminatingId(null);
            setSessionToTerminate(null);
        }
    };

    const getDeviceIcon = (userAgent: string | null) => {
        if (!userAgent) return <Globe className="h-5 w-5" />;
        const ua = userAgent.toLowerCase();
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
            return <Smartphone className="h-5 w-5" />;
        }
        return <Laptop className="h-5 w-5" />;
    };

    const getBrowserName = (userAgent: string | null) => {
        if (!userAgent) return "Unknown Browser";
        if (userAgent.includes("Firefox")) return "Firefox";
        if (userAgent.includes("Chrome")) return "Chrome";
        if (userAgent.includes("Safari")) return "Safari";
        if (userAgent.includes("Edge")) return "Edge";
        return "Unknown Browser";
    };

    const getOSName = (userAgent: string | null) => {
        if (!userAgent) return "Unknown OS";
        if (userAgent.includes("Windows")) return "Windows";
        if (userAgent.includes("Mac")) return "macOS";
        if (userAgent.includes("Linux")) return "Linux";
        if (userAgent.includes("Android")) return "Android";
        if (userAgent.includes("iOS")) return "iOS";
        return "Unknown OS";
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Sessions</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your active sessions on other devices.
                </p>
            </div>
            <Separator />

            {loading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {sessions.map((session) => (
                        <Card key={session.id} className={session.isCurrent ? "border-primary" : ""}>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-muted rounded-full">
                                            {getDeviceIcon(session.userAgent)}
                                        </div>
                                        <div className="space-y-1">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                {getOSName(session.userAgent)} • {getBrowserName(session.userAgent)}
                                                {session.isCurrent && (
                                                    <Badge variant="default" className="text-xs">
                                                        Current Session
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-2 text-xs">
                                                <span>{session.ipAddress || "Unknown IP"}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Last active {session.updatedAt ? formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true }) : "Unknown"}
                                                </span>
                                            </CardDescription>
                                        </div>
                                    </div>
                                    {!session.isCurrent && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => setSessionToTerminate(session)}
                                            disabled={terminatingId === session.id}
                                        >
                                            {terminatingId === session.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">Revoke</span>
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                        </Card>
                    ))}

                    {sessions.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                            No active sessions found.
                        </div>
                    )}
                </div>
            )}

            <AlertDialog open={!!sessionToTerminate} onOpenChange={(open) => !open && setSessionToTerminate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to revoke this session? The device will be logged out immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Revoke Session
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
