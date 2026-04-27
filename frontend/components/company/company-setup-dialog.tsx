"use client";

import { useState } from "react";
import { useCompany } from "@/components/providers/company-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CompanySetupDialogProps {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    allowClose?: boolean;
}

export function CompanySetupDialog({
    open,
    onOpenChange,
    allowClose = false,
}: CompanySetupDialogProps) {
    const { createAndSelectCompany } = useCompany();
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-generate code from name
    const handleNameChange = (value: string) => {
        setName(value);
        // Auto-generate code if not manually edited
        if (!code || code === generateCode(name)) {
            setCode(generateCode(value));
        }
    };

    const generateCode = (str: string) => {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_|_$/g, "")
            .substring(0, 20);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("Company name is required");
            return;
        }

        if (!code.trim()) {
            setError("Company code is required");
            return;
        }

        // Validate code format
        if (!/^[a-z0-9_]+$/.test(code)) {
            setError("Code can only contain lowercase letters, numbers, and underscores");
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await createAndSelectCompany(name.trim(), code.trim());

            if (!result.success) {
                setError(result.message || "Failed to create company");
                toast.error(result.message || "Failed to create company");
            } else {
                toast.success("Company created successfully!");
                setName("");
                setCode("");
                onOpenChange?.(false);
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
            toast.error("Failed to create company");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={allowClose ? onOpenChange : undefined}>
            <DialogContent
                className="sm:max-w-[500px]"
                onInteractOutside={(e) => {
                    if (!allowClose) e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (!allowClose) e.preventDefault();
                }}
                showCloseButton={false}
            >
                <DialogHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
                        <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-2xl">
                        Welcome! Let&apos;s Get Started
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Create your first company to begin using the application.
                        <br />
                        <span className="text-xs text-muted-foreground">
                            This will provision a dedicated database for your company.
                        </span>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="company-name" className="text-sm font-medium">
                                Company Name
                            </Label>
                            <Input
                                id="company-name"
                                value={name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                placeholder="Acme Corporation"
                                className="h-11"
                                disabled={isSubmitting}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company-code" className="text-sm font-medium">
                                Company Code
                            </Label>
                            <Input
                                id="company-code"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toLowerCase())}
                                placeholder="acme_corp"
                                className="h-11 font-mono"
                                disabled={isSubmitting}
                            />
                            <p className="text-xs text-muted-foreground">
                                Unique identifier for your company. Use lowercase letters, numbers, and underscores.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || !code.trim()}
                            className="w-full h-11 gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating Company...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Create Company & Get Started
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
