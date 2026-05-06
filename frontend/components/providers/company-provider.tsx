"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
    Company,
    getCompanies,
    checkCompaniesExist,
    createCompany,
    setCurrentCompany as setCurrentCompanyAction,
    getCurrentCompany
} from "@/lib/actions/companies";
import { useAuth } from "@/components/providers/auth-provider";

interface CompanyContextType {
    currentCompany: Company | null;
    companies: Company[];
    loading: boolean;
    needsSetup: boolean;
    selectCompany: (company: Company) => Promise<void>;
    refreshCompanies: () => Promise<void>;
    createAndSelectCompany: (name: string, code: string) => Promise<{ success: boolean; message?: string }>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

interface CompanyProviderProps {
    children: ReactNode;
}

export function CompanyProvider({ children }: CompanyProviderProps) {
    const router = useRouter();
    const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [mounted, setMounted] = useState(false);
    // const { } = useAuth(); // Removed loading controls

    // Internal function to select company and update cookies via server action
    const selectCompanyInternal = useCallback(async (company: Company) => {
        // Set company in state
        setCurrentCompany(company);

        // Use server action to set cookies with correct domain/path
        await setCurrentCompanyAction(company);
    }, []);

    // Initialize company state from cookie or fetch
    const initializeCompany = useCallback(async () => {
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log("[CompanyProvider] Starting initializeCompany");
            }
            setLoading(true);

            // 1. Try to get current company from server action (reads cookies correctly)
            if (process.env.NODE_ENV === 'development') {
                console.log("[CompanyProvider] Calling getCurrentCompany");
            }
            const savedCompany = await getCurrentCompany();
            if (savedCompany) {
                if (process.env.NODE_ENV === 'development') {
                    console.log("[CompanyProvider] Saved company found:", savedCompany.name);
                }
                setCurrentCompany(savedCompany);
            }

            // 2. Check if companies exist via server action
            if (process.env.NODE_ENV === 'development') {
                console.log("[CompanyProvider] Calling checkCompaniesExist");
            }
            const { hasCompanies } = await checkCompaniesExist();

            if (!hasCompanies) {
                if (process.env.NODE_ENV === 'development') {
                    console.log("[CompanyProvider] No companies found");
                }
                setNeedsSetup(true);
                setCompanies([]);
                setCurrentCompany(null);
                return;
            }

            // 3. Fetch companies list via server action
            if (process.env.NODE_ENV === 'development') {
                console.log("[CompanyProvider] Calling getCompanies");
            }
            const { data: companiesList } = await getCompanies();

            if (companiesList && companiesList.length > 0) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[CompanyProvider] Found ${companiesList.length} companies`);
                }
                setCompanies(companiesList);

                // If no current company is set, or if the saved company is no longer active/valid
                const isValidCompany = savedCompany && companiesList.some(c => c.id === savedCompany.id);
                if (!isValidCompany) {
                    if (process.env.NODE_ENV === 'development') {
                        console.log("[CompanyProvider] Selecting first available company");
                    }
                    await selectCompanyInternal(companiesList[0]);
                }

                setNeedsSetup(false);
            } else {
                setNeedsSetup(true);
            }
        } catch (error) {
            console.error("[CompanyProvider Error] Failed to initialize company:", error);
        } finally {
            if (process.env.NODE_ENV === 'development') {
                console.log("[CompanyProvider] initializeCompany complete");
            }
            setLoading(false);
        }
    }, [selectCompanyInternal]);

    // Public function to select company
    const selectCompany = useCallback(async (company: Company) => {
        await selectCompanyInternal(company);
        // Optionally refresh the page to apply new company context
        router.refresh();
    }, [router, selectCompanyInternal]);

    // Refresh companies list
    const refreshCompanies = useCallback(async () => {
        try {
            const { data } = await getCompanies();
            const list = data || [];

            setCompanies(list);
            setNeedsSetup(list.length === 0);
        } catch (error) {
            console.error("Failed to refresh companies:", error);
        }
    }, []);

    // Create a new company and select it using server actions
    const createAndSelectCompany = useCallback(
        async (name: string, code: string): Promise<{ success: boolean; message?: string }> => {
            try {
                const response = await createCompany({ name, code });

                if (!response.status || !response.data) {
                    return {
                        success: false,
                        message: response.message || "Failed to create company",
                    };
                }

                // Add to companies list
                const newCompany = response.data;
                setCompanies((prev) => [newCompany, ...prev]);

                // Select the new company
                await selectCompanyInternal(newCompany);
                setNeedsSetup(false);

                // Refresh the page to apply new company context
                router.refresh();

                return { success: true, message: "Company created successfully" };
            } catch (error: any) {
                console.error("Failed to create company:", error);
                return {
                    success: false,
                    message: error.message || "Failed to create company",
                };
            }
        },
        [router, selectCompanyInternal]
    );

    // Mount and initialize
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            initializeCompany();
        }
    }, [mounted, initializeCompany]);

    const value: CompanyContextType = {
        currentCompany,
        companies,
        loading,
        needsSetup,
        selectCompany,
        refreshCompanies,
        createAndSelectCompany,
    };

    return (
        <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
    );
}

export function useCompany() {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error("useCompany must be used within a CompanyProvider");
    }
    return context;
}
