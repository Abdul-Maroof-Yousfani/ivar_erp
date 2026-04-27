import { AlertTriangle } from "lucide-react";

interface ListErrorProps {
    title?: string;
    message?: string;
    className?: string;
}

export function ListError({
    title = "Something went wrong",
    message = "An error occurred while loading the data. Please try again.",
    className = ""
}: ListErrorProps) {
    return (
        <div className={`rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center ${className}`}>
            <div className="flex flex-col items-center justify-center space-y-3">
                <div className="rounded-full bg-destructive/20 p-3">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-1">
                    <h3 className="font-semibold text-destructive">{title}</h3>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            </div>
        </div>
    );
}
