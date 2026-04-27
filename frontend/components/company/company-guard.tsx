"use client";

import { useCompany } from "@/components/providers/company-provider";
import { CompanySetupDialog } from "@/components/company/company-setup-dialog";
import { ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";

interface CompanyGuardProps {
    children: ReactNode;
    /**
     * If true, only check for company but don't block rendering
     * (useful for admin pages that manage companies)
     */
    optional?: boolean;
}

/**
 * Guards pages that require a company to be selected.
 * Shows setup dialog if no companies exist.
 * Loading state is handled globally by AuthProvider during initial load.
 */
export function CompanyGuard({ children, optional = false }: CompanyGuardProps) {
    const { currentCompany, needsSetup, loading } = useCompany();
    const { loading: authLoading, isAuthenticated } = useAuth();

    // While loading, if it's the initial load, AuthProvider covers with a LoadingScreen.
    // If not initial load, we still shouldn't show children if they depend on company.
    if (loading || authLoading) {
        return null; // AuthProvider handles the loading UI globally
    }

    // If optional mode, always render children
    if (optional) {
        return (
            <>
                {children}
                {/* Still show setup dialog if needed, but don't block */}
                <CompanySetupDialog open={needsSetup && isAuthenticated} allowClose={true} />
            </>
        );
    }

    // If no companies exist, force setup
    if (needsSetup && isAuthenticated) {
        return (
            <>
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="text-center space-y-4">
                        <h2 className="text-2xl font-bold">Company Setup Required</h2>
                        <p className="text-muted-foreground max-w-md">
                            Please create a company to continue using the application.
                        </p>
                    </div>
                </div>
                <CompanySetupDialog open={true} allowClose={false} />
            </>
        );
    }

    // If no current company but companies exist, this shouldn't happen
    // as the provider auto-selects the first one
    if (!currentCompany) {
        return null;
    }

    // All good, render children
    return <>{children}</>;
}
