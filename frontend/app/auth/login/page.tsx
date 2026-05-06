"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, AlertCircle, EyeOff, Eye } from "lucide-react";
import { loginClient } from "@/lib/client-auth";
import Image from "next/image";
import Link from "next/link";

// Helper to build subdomain URL
function buildSubdomainUrl(subdomain: string, path: string, port?: string): string {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const isDevelopment = hostname.includes("localhost") || hostname.includes("127.0.0.1") || hostname.includes("localtest.me");

  if (isDevelopment) {
    let baseDomain = "localhost";
    if (hostname.includes("localtest.me")) {
      baseDomain = "localtest.me";
    }
    const portStr = port || window.location.port || "3001";
    return `${protocol}//${subdomain}.${baseDomain}:${portStr}${path}`;
  } else {
    // For production, use spl.inplsoftwares.com as base
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "spl.inplsoftwares.com";
    return `${protocol}//${subdomain}.${baseDomain}${path}`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/hr");
  const [targetSubdomain, setTargetSubdomain] = useState("hr");
  const [emailValue, setEmailValue] = useState("");
  const [hasSavedAccounts, setHasSavedAccounts] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    const subdomain = params.get("subdomain");
    const emailParam = params.get("email");
    const forceLogin = params.get("forceLogin");

    // Check local storage for remembered profiles
    const remembered = JSON.parse(localStorage.getItem("rememberedProfiles") || "[]");
    setHasSavedAccounts(remembered.length > 0);

    // If we have NO email param and NO forceLogin, ALWAYS redirect to choose-account
    // This makes the choose-account page the primary entry point
    if (!emailParam && !forceLogin) {
      const search = window.location.search;
      router.push(`/auth/choose-account${search}`);
      return;
    }

    if (emailParam) {
      setEmailValue(emailParam);
    }

    if (cb) {
      // Normalize callback URL - ensure it starts with /hr, /admin, etc.
      let normalizedUrl = cb;
      if (!cb.startsWith("/hr") && !cb.startsWith("/admin") && !cb.startsWith("/master")) {
        // If it's /dashboard or similar, convert to /hr
        if (cb.startsWith("/dashboard")) {
          normalizedUrl = cb.replace("/dashboard", "/hr");
        } else {
          normalizedUrl = `/hr${cb}`;
        }
      }
      setCallbackUrl(normalizedUrl);
    }

    if (subdomain) {
      setTargetSubdomain(subdomain);
    } else if (cb) {
      // Determine subdomain from callback URL
      if (cb.startsWith("/admin")) {
        setTargetSubdomain("admin");
      } else if (cb.startsWith("/master")) {
        setTargetSubdomain("master");
      } else {
        setTargetSubdomain("hr");
      }
    }
  }, []);

  // Helper to strip subdomain prefix from path for URL
  function stripSubdomainPrefix(path: string, subdomain: string): string {
    const prefix = `/${subdomain}`;
    if (path.startsWith(prefix)) {
      const remaining = path.slice(prefix.length);
      return remaining || "/";
    }
    return path;
  }

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await loginClient(email, password);

      if (result.status && result.user) {
        // Store profile in local storage for "Choose Account" screen
        const remembered = JSON.parse(localStorage.getItem("rememberedProfiles") || "[]");
        const existingIndex = remembered.findIndex((p: any) => p.email === email);
        if (existingIndex > -1) {
          remembered[existingIndex] = result.user;
        } else {
          remembered.push(result.user);
        }
        localStorage.setItem("rememberedProfiles", JSON.stringify(remembered));

        // Get port from current URL
        const port = window.location.port || "3001";
        // Strip subdomain prefix from callback URL for the final URL
        const finalPath = stripSubdomainPrefix(callbackUrl, targetSubdomain);
        // Build redirect URL with correct subdomain and port
        const redirectUrl = buildSubdomainUrl(targetSubdomain, finalPath, port);
        // Use window.location for full page navigation to change subdomain
        window.location.href = redirectUrl;
      } else {
        setError(result.message);
        setIsPending(false);
      }
    } catch (err) {
      setError("An unexpected error occurred during login.");
      setIsPending(false);
    }
  };

  return (
    <Card className="shadow-2xl backdrop-blur-sm bg-card/95">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
          <LogIn className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive" className="animate-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
              {hasSavedAccounts && (
                <Link
                  href={`/auth/choose-account${window.location.search}`}
                  className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  {emailValue ? "Not you?" : "Use saved account"}
                </Link>
              )}
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@company.com"
              required
              disabled={isPending}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="h-11 border-primary/10 focus-visible:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" title="Password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                disabled={isPending}
                className="pr-10 h-11 border-primary/10 focus-visible:ring-primary/20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-primary"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button type="submit" className="w-full h-11 font-bold tracking-wide" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
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
      </form>
    </Card>
  );
}
