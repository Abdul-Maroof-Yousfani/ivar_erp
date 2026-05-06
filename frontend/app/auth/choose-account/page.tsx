"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, LogOut, ChevronRight, Mail } from "lucide-react";
import { getAvailableProfilesClient, User } from "@/lib/client-auth";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

export default function ChooseAccountPage() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProfiles() {
            setLoading(true);
            try {
                // Fetch active sessions from backend
                const activeProfiles = await getAvailableProfilesClient();

                // Also check local storage for "remembered" profiles (Signed out)
                let remembered: any[] = [];
                try {
                    const stored = localStorage.getItem("rememberedProfiles");
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (Array.isArray(parsed)) {
                            remembered = parsed;
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse rememberedProfiles from localStorage", e);
                    // Clear invalid data
                    localStorage.removeItem("rememberedProfiles");
                }

                // Merge lists
                const mergedMap = new Map();

                // Start with remembered (mark all as inactive)
                remembered.forEach((p: any) => mergedMap.set(p.email, { ...p, isActive: false }));

                // Overwrite with active sessions
                if (Array.isArray(activeProfiles)) {
                    activeProfiles.forEach((p: any) => mergedMap.set(p.email, { ...p, isActive: true }));
                }

                setProfiles(Array.from(mergedMap.values()));
            } catch (err) {
                console.error("Failed to load profiles", err);
            } finally {
                setLoading(false);
            }
        }

        loadProfiles();
    }, []);

    const handleSelectAccount = (email: string) => {
        // Redirect to login page with email prefilled
        const params = new URLSearchParams();
        params.set("email", email);
        router.push(`/auth/login?${params.toString()}`);
    };

    const handleUseAnotherAccount = () => {
        const params = new URLSearchParams(window.location.search);
        params.set("forceLogin", "true");
        router.push(`/auth/login?${params.toString()}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    if(profiles.length === 0) router.push("/auth/login?forceLogin=true");
    return (
        <Card className="shadow-2xl backdrop-blur-sm bg-card/95">

            <CardHeader className="text-center space-y-2 pb-6">
                <CardTitle className="text-2xl font-bold tracking-tight">Choose an account</CardTitle>
                <CardDescription>Select an account to continue to Speed Limit</CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-y max-h-[400px] overflow-y-auto custom-scrollbar">
                {profiles.length > 0 ? (
                    <div className="divide-y divide-border/50">
                        {profiles.map((profile) => (
                            <button
                                key={profile.email}
                                onClick={() => handleSelectAccount(profile.email)}
                                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/50 transition-all group active:scale-[0.98]"
                            >
                                <Avatar className="h-11 w-11 border-2 border-transparent group-hover:border-primary/20 transition-all shadow-sm">
                                    <AvatarImage src={profile.avatar} />
                                    <AvatarFallback className="bg-primary/5 text-primary text-sm font-bold">
                                        {profile.firstName?.[0]}{profile.lastName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate leading-none mb-1 group-hover:text-primary transition-colors">
                                        {profile.firstName} {profile.lastName}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {profile.email}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    {profile.isActive ? (
                                        <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Signed in</span>
                                    ) : (
                                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Signed out</span>
                                    )}
                                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center space-y-4">
                        <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-primary/10">
                            <Mail className="h-8 w-8 text-primary/40" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No accounts found on this device.</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2 p-4 pt-6">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-4 h-12 font-bold text-sm hover:bg-primary/5 hover:text-primary transition-all pr-2"
                    onClick={handleUseAnotherAccount}
                >
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <UserPlus className="h-4 w-4" />
                    </div>
                    Use another account
                    <ChevronRight className="h-4 w-4 ml-auto opacity-30" />
                </Button>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-4 h-12 font-bold text-xs text-destructive hover:text-destructive hover:bg-destructive/5 transition-all pr-2"
                    onClick={() => {
                        localStorage.removeItem("rememberedProfiles");
                        setProfiles([]);
                    }}
                >
                    <div className="bg-destructive/10 p-2 rounded-lg">
                        <LogOut className="h-4 w-4" />
                    </div>
                    Remove all accounts from device
                </Button>

                <div className="w-full pt-4 mt-2 border-t border-border/50">
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                            Powered by
                        </p>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <Image
                                src="/logo.png"
                                alt="Innovative Network Logo"
                                width={18}
                                height={18}
                                className="object-contain"
                            />
                            <span className="text-xs font-bold bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                Innovative Network Pvt Ltd
                            </span>
                        </div>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
