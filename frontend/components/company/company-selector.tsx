"use client";

import { useState } from "react";
import { useCompany } from "@/components/providers/company-provider";
import { Company } from "@/lib/actions/companies";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface CompanySelectorProps {
    showCreateOption?: boolean;
    showSettingsOption?: boolean;
    className?: string;
}

export function CompanySelector({
    showCreateOption = false,
    showSettingsOption = false,
    className,
}: CompanySelectorProps) {
    const router = useRouter();
    const { currentCompany, companies, selectCompany, loading } = useCompany();
    const [isOpen, setIsOpen] = useState(false);

    const handleSelectCompany = async (company: Company) => {
        await selectCompany(company);
        setIsOpen(false);
    };

    if (loading) {
        return (
            <Button variant="ghost" className={cn("gap-2", className)} disabled>
                <Building2 className="h-4 w-4" />
                <span className="animate-pulse">Loading...</span>
            </Button>
        );
    }

    if (!currentCompany) {
        return (
            <Button
                variant="outline"
                className={cn("gap-2", className)}
                onClick={() => router.push("/admin/companies")}
            >
                <Building2 className="h-4 w-4" />
                <span>Select Company</span>
            </Button>
        );
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("gap-2 max-w-[200px]", className)}>
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="truncate">{currentCompany.name}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Switch Company
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {companies.map((company) => (
                    <DropdownMenuItem
                        key={company.id}
                        onClick={() => handleSelectCompany(company)}
                        className="flex items-center justify-between cursor-pointer"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{company.name}</span>
                        </div>
                        {currentCompany.id === company.id && (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}

                {(showCreateOption || showSettingsOption) && (
                    <>
                        <DropdownMenuSeparator />

                        {showCreateOption && (
                            <DropdownMenuItem
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/admin/companies");
                                }}
                                className="cursor-pointer"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Company
                            </DropdownMenuItem>
                        )}

                        {showSettingsOption && (
                            <DropdownMenuItem
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/admin/companies");
                                }}
                                className="cursor-pointer"
                            >
                                <Settings className="h-4 w-4 mr-2" />
                                Manage Companies
                            </DropdownMenuItem>
                        )}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
