"use client";

import { useState, useEffect } from "react";
import { Company } from "@/lib/actions/companies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCompany } from "@/components/providers/company-provider";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, Loader2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

interface CompanyListProps {
  initialCompanies: Company[];
  userPermissions: string[];
}

export function CompanyList({ initialCompanies, userPermissions }: CompanyListProps) {
  const {
  currentCompany,
    companies: providerCompanies,
    selectCompany,
    createAndSelectCompany,
    refreshCompanies,
    loading,
  } = useCompany();

  const [companies, setCompanies] = useState(initialCompanies);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {hasPermission} = useAuth()
  // Sync with provider companies
  useEffect(() => {
    if (providerCompanies.length > 0) {
      setCompanies(providerCompanies);
    }
  }, [providerCompanies]);

  // Very strict restriction: only users with this permission can manage tenants/companies
  const canManageCompanies = hasPermission("admin.company.manage");

  // Auto-generate code from name
  const handleNameChange = (value: string) => {
    setName(value);
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
    if (!canManageCompanies) {
      toast.error("You are not allowed to manage companies");
      return;
    }

    if (!name || !code) {
      toast.error("Name and code are required");
      return;
    }

    // Validate code format
    if (!/^[a-z0-9_]+$/.test(code)) {
      toast.error("Code can only contain lowercase letters, numbers, and underscores");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createAndSelectCompany(name.trim(), code.trim());
      if (!result.success) {
        toast.error(result.message || "Failed to create company");
      } else {
        toast.success("Company created successfully! Database provisioned.");
        setName("");
        setCode("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error while creating company");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshCompanies();
      toast.success("Companies refreshed");
    } catch (err) {
      toast.error("Failed to refresh companies");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelect = async (company: Company) => {
    try {
      await selectCompany(company);
      toast.success(`Switched to ${company.name}`);
    } catch (err) {
      toast.error("Failed to switch company");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground">
            Global tenant/company management. Each company gets its own database.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {canManageCompanies ? (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-lg border bg-card p-6 md:grid-cols-3"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Company Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corporation"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              placeholder="acme_corp"
              className="font-mono"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase, numbers, underscores only.
            </p>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting || !name || !code} className="gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Company
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          You do not have permission to manage companies. Ask a super admin for
          the <code className="mx-1 rounded bg-muted px-1 py-0.5">admin.company.manage</code>{" "}
          permission.
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Existing Companies</h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No companies yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first company to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => {
              const isSelected = currentCompany?.id === company.id;
              return (
                <div
                  key={company.id}
                  className={cn(
                    "relative rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => handleSelect(company)}
                >
                  {isSelected && (
                    <div className="absolute -right-2 -top-2 rounded-full bg-primary p-1">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate">{company.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">
                        {company.code}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Badge
                      variant={company.status === "active" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {company.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                      {company.dbName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
