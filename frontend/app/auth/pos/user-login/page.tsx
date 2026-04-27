"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Monitor, UserRoundCog } from "lucide-react";
import { loginClient } from "@/lib/client-auth";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

export default function PosUserLogin() {
    const { refreshUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/pos";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        if (!email || !password) {
            setError("Please enter both email and password");
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                // Standard login — same as HR/ERP, one unified accessToken
                const result = await loginClient(email, password);

                if (result.status) {
                    toast.success(`Welcome, ${result.user?.firstName || "User"}`);
                    // Refresh user state
                    await refreshUser();

                    // Redirect to the POS callback URL
                    window.location.href = callbackUrl;
                } else {
                    setError(result.message || "Login failed");
                }
            } catch {
                setError("An error occurred. Please try again.");
            }
        });
    };

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl border-primary/10">
                <CardHeader className="text-center pb-4">
                    <div className="bg-primary/10 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border border-primary/20">
                        <UserRoundCog className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Cashier Login</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Enter your credentials to start your shift
                    </p>
                </CardHeader>

                <CardContent className="space-y-5">
                    {error && (
                        <Alert variant="destructive" className="animate-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="font-medium text-sm">{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                            placeholder="user@example.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                            placeholder="••••••••"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        />
                    </div>

                    <Button
                        className="w-full h-11 font-bold"
                        onClick={handleSubmit}
                        disabled={isPending || !email || !password}
                    >
                        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                        START SHIFT
                    </Button>

                    <div className="flex items-center justify-center gap-2 pt-4 border-t mt-4">
                        <Monitor className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            Terminal Registered
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
