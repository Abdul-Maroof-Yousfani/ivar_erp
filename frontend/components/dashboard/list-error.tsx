"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

interface ListErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ListError({ 
  title = "Failed to load data", 
  message = "An error occurred while loading the data. Please try again.",
  onRetry 
}: ListErrorProps) {
  const router = useRouter();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">Unable to load the requested data</p>
      </div>

      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="mt-2">
          {message}
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button onClick={handleRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
        <Button onClick={() => router.back()} variant="ghost">
          Go Back
        </Button>
      </div>
    </div>
  );
}

