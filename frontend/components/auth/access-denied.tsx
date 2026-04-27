    import { ShieldAlert } from "lucide-react";
    import Link from "next/link";
    import { Button } from "@/components/ui/button";

    interface AccessDeniedProps {
        message?: string;
    }

    export function AccessDenied({ message = "You do not have permission to access this resource." }: AccessDeniedProps) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px] border rounded-lg bg-card dark:bg-card/50 dashed border-card dark:border-card">
                <div className="h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h2>
                <p className="text-muted-foreground max-w-[400px] mb-6">
                    {message}
                </p>
                <div className="flex gap-4">
                    <Button asChild variant="outline">
                        <a href="/">Return to Dashboard</a>
                    </Button>
                </div>
            </div>
        );
    }
