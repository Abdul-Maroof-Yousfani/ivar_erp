"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { createRole, updateRole, Role } from "@/lib/actions/roles";
import { Permission } from "@/lib/actions/permissions";
import { Loader2, Check, Shield, Search, FolderOpen } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

interface RoleFormProps {
  initialData?: Role;
  permissions: Permission[];
}

export function RoleForm({ initialData, permissions }: RoleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      permissionIds: initialData?.permissions?.map((p) => p.permission.id) || [],
    },
  });

  const erpMasterModules = [
    "master.brand", "master.division", "master.channel-class", "master.color", 
    "master.gender", "master.size", "master.silhouette", "master.tax-rate",
    "master.item-class", "master.item-subclass", "master.old-season", "master.season", 
    "master.segment", "master.hs-code", "master.category", "master.sub-category", "master.uom"
  ];

  const posMasterModules = [
    "master.promo", "master.coupon", "master.alliance"
  ];

  // Define module categorization
  const getCategory = (module: string): "HR" | "Master" | "ERP" | "POS" => {
    if (module.startsWith("pos.")) return "POS";

    if (erpMasterModules.includes(module) || posMasterModules.includes(module) || module.startsWith("master.") || 
        ["country", "state", "city", "location", "bank", "equipment", 
         "allowance-head", "deduction-head", "salary-breakup", "tax-slab", 
         "bonus-type", "loan-type", "leave-type", "leaves-policy", "eobi", "provident-fund",
         "approval-setting", "rebate-nature", "role"].includes(module)) {
      return "Master";
    }
    
    if (module.startsWith("erp.")) return "ERP";
    
    return "HR";
  };

  const getMasterSubCategory = (module: string): "HR" | "ERP" | "POS" => {
    if (posMasterModules.includes(module) || module === 'master.pos') return 'POS';
    if (erpMasterModules.includes(module)) return 'ERP';
    return 'HR';
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const modules = Object.keys(groupedPermissions).sort();
  
  // Group modules by category
  const modulesByCategory = {
    HR:     modules.filter(m => getCategory(m) === "HR"),
    Master: modules.filter(m => getCategory(m) === "Master"),
    ERP:    modules.filter(m => getCategory(m) === "ERP"),
    POS:    modules.filter(m => getCategory(m) === "POS"),
  };

  const selectedPermissionIds = form.watch("permissionIds");

  // Filtered permissions based on SearchTerm
  const filteredGroupedPermissions = (Object.entries(groupedPermissions) as [string, Permission[]][]).reduce((acc, [module, perms]) => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) {
      acc[module] = perms;
      return acc;
    }

    const matchedPerms = perms.filter(p => 
      p.name.toLowerCase().includes(search) ||
      (p.description || "").toLowerCase().includes(search) ||
      p.action.toLowerCase().includes(search) ||
      module.toLowerCase().includes(search)
    );

    if (matchedPerms.length > 0) {
      acc[module] = matchedPerms;
    }
    return acc;
  }, {} as Record<string, Permission[]>);

  const filteredModules = Object.keys(filteredGroupedPermissions).sort();

  const filteredModulesByCategory = {
    HR:     filteredModules.filter(m => getCategory(m) === "HR"),
    Master: filteredModules.filter(m => getCategory(m) === "Master"),
    ERP:    filteredModules.filter(m => getCategory(m) === "ERP"),
    POS:    filteredModules.filter(m => getCategory(m) === "POS"),
  };

  // Helper to get selected count per category
  const getSelectedCount = (category: "HR" | "Master" | "ERP" | "POS") => {
    return modulesByCategory[category].reduce((count, module) => {
      const perms = groupedPermissions[module];
      return count + perms.filter(p => selectedPermissionIds.includes(p.id)).length;
    }, 0);
  };

  // Helper to get total count per category
  const getTotalCount = (category: "HR" | "Master" | "ERP" | "POS") => {
     return modulesByCategory[category].reduce((count, module) => {
      return count + groupedPermissions[module].length;
    }, 0);
  };

  async function onSubmit(values: FormValues) {
    startTransition(async () => {
      if (initialData) {
        const result = await updateRole(initialData.id, values);
        if (result.status) {
          toast.success("Role updated successfully");
          router.push("/admin/roles");
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await createRole(values);
        if (result.status) {
          toast.success("Role created successfully");
          router.push("/admin/roles");
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }
    });
  }

  const handleModuleSelect = (module: string, checked: boolean) => {
    const modulePermissions = (filteredGroupedPermissions[module] || []).map(p => p.id);
    const currentPermissions = form.getValues("permissionIds");
    
    let newPermissions: string[];
    if (checked) {
        newPermissions = [...new Set([...currentPermissions, ...modulePermissions])];
    } else {
        newPermissions = currentPermissions.filter(id => !modulePermissions.includes(id));
    }
    
    form.setValue("permissionIds", newPermissions, { shouldDirty: true });
  };

  const handleSelectAllInCategory = (category: "HR" | "Master" | "ERP" | "POS", select: boolean) => {
     let categoryModules = modulesByCategory[category];
     
     if (category === "Master" && masterFilter !== "All") {
         categoryModules = categoryModules.filter(m => getMasterSubCategory(m) === masterFilter);
     }
     
     let idsToToggle: string[] = [];
     
     categoryModules.forEach(module => {
         idsToToggle.push(...groupedPermissions[module].map(p => p.id));
     });

     const currentPermissions = form.getValues("permissionIds");
     let newPermissions: string[];

     if (select) {
         newPermissions = [...new Set([...currentPermissions, ...idsToToggle])];
     } else {
         newPermissions = currentPermissions.filter(id => !idsToToggle.includes(id));
     }
     form.setValue("permissionIds", newPermissions, { shouldDirty: true });
  };

  const renderModuleList = (categoryModules: string[]) => (
      <div className="space-y-6">
          {categoryModules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <Shield className="h-8 w-8 text-muted-foreground/35" />
                  No modules found in this category.
              </div>
          )}
          {categoryModules.map((module) => {
              const perms = filteredGroupedPermissions[module] || [];
              const allSelected = perms.every(p => selectedPermissionIds.includes(p.id));
              const someSelected = perms.some(p => selectedPermissionIds.includes(p.id));

              return (
                  <div key={module} className="space-y-3 border rounded-xl p-4 bg-muted/5 shadow-sm hover:shadow-md transition-all duration-200">
                      <div className="flex items-center space-x-2 border-b border-border/40 pb-2 mb-2">
                          <Checkbox 
                              id={`module-${module}`}
                              checked={allSelected ? true : someSelected ? "indeterminate" : false}
                              onCheckedChange={(checked) => handleModuleSelect(module, !!checked)}
                              className="h-4 w-4 rounded-md border-muted-foreground/30 focus-visible:ring-violet-500/50"
                          />
                          <label htmlFor={`module-${module}`} className="text-xs font-bold leading-none uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 cursor-pointer select-none">
                              <FolderOpen className="h-3.5 w-3.5 text-violet-500/80" />
                              {module
                                .replace(/^hr\./, '')
                                .replace(/^master\./, '')
                                .replace(/^erp\.finance\./, '')
                                .replace(/^erp\.procurement\./, '')
                                .replace(/^erp\.inventory\./, '')
                                .replace(/^erp\./, '')
                                .replace(/^pos\./, '')
                                .replace(/-/g, ' ')}
                          </label>
                      </div>
                      <div className="ml-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {perms.map((permission) => {
                              const isChecked = selectedPermissionIds.includes(permission.id);
                              return (
                                <FormField
                                    key={permission.id}
                                    control={form.control}
                                    name="permissionIds"
                                    render={({ field }) => (
                                        <FormItem
                                            key={permission.id}
                                            className={`flex flex-row items-center space-x-2.5 space-y-0 p-2 rounded-lg border transition-all duration-150 ${
                                                isChecked
                                                    ? "bg-violet-500/5 border-violet-500/25 hover:bg-violet-500/10 shadow-inner"
                                                    : "bg-background border-border/60 hover:bg-muted/30"
                                            }`}
                                        >
                                            <FormControl>
                                                <Checkbox
                                                    checked={isChecked}
                                                    onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...field.value, permission.id])
                                                            : field.onChange(
                                                                field.value?.filter(
                                                                    (value) => value !== permission.id
                                                                )
                                                            )
                                                    }}
                                                    className="h-3.5 w-3.5 rounded border-muted-foreground/30 focus-visible:ring-violet-500/50"
                                                />
                                            </FormControl>
                                            <FormLabel className="font-medium text-xs cursor-pointer select-none flex-1 truncate py-0.5">
                                                {permission.action}
                                            </FormLabel>
                                        </FormItem>
                                    )}
                                />
                              );
                          })}
                      </div>
                  </div>
              );
          })}
      </div>
  );

  const [activeTab, setActiveTab] = useState<"HR" | "Master" | "ERP" | "POS">("HR");
  const [masterFilter, setMasterFilter] = useState<"All" | "HR" | "ERP" | "POS">("All");

  const pageTitle = initialData ? `Edit Role: ${initialData.name}` : "Create New Role";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">{pageTitle}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Role Details & Summary */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="border-t-4 border-t-violet-600 bg-background/95 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-bold">Role Details</CardTitle>
                        <CardDescription className="text-xs">Provide a name and descriptor for the role definition.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Role Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Product Information" {...field} className="h-9 focus-visible:ring-violet-500/50" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the role's access permissions" {...field} className="min-h-[100px] focus-visible:ring-violet-500/50" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </CardContent>
                </Card>

                {/* Permissions Summary Card */}
                <Card className="border-t-4 border-t-fuchsia-600 bg-background/95 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                            <Shield className="h-5 w-5 text-violet-600" />
                            Permissions Summary
                        </CardTitle>
                        <CardDescription className="text-xs">Overview of assigned permissions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {(["HR", "Master", "ERP", "POS"] as const).map((cat) => {
                            const count = getSelectedCount(cat);
                            const total = getTotalCount(cat);
                            return (
                                <div key={cat} className="space-y-2">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="text-muted-foreground">{cat}</span>
                                        <span className="text-foreground">{count} / {total}</span>
                                    </div>
                                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300 rounded-full" 
                                            style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Permission Tabs content */}
            <div className="lg:col-span-8">
                <Tabs value={activeTab} onValueChange={(val) => {
                    setActiveTab(val as any);
                    setSearchTerm("");
                }} className="w-full">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-col gap-4 pb-4 border-b border-border/60">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <TabsList className="grid w-full sm:w-[400px] grid-cols-4 bg-muted/40">
                                    <TabsTrigger value="HR">HR</TabsTrigger>
                                    <TabsTrigger value="Master">Master</TabsTrigger>
                                    <TabsTrigger value="ERP">ERP</TabsTrigger>
                                    <TabsTrigger value="POS">POS</TabsTrigger>
                                </TabsList>
                                
                                <div className="relative w-full sm:w-64 shrink-0">
                                    <Search className="absolute left-2.5 top-2 text-muted-foreground h-4 w-4" />
                                    <input
                                        type="text"
                                        placeholder="Search permissions..."
                                        className="flex h-8 w-full rounded-lg border border-input/60 bg-background pl-8 pr-3 py-1 text-xs shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/50">
                                <span>Configure the permission matrix for this role.</span>
                                <div className="flex gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] px-2.5 rounded-md hover:bg-background shadow-sm transition-all"
                                        onClick={() => handleSelectAllInCategory(activeTab, true)}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] px-2.5 rounded-md hover:bg-background shadow-sm transition-all"
                                        onClick={() => handleSelectAllInCategory(activeTab, false)}
                                    >
                                        Deselect All
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <ScrollArea className="h-[490px] pr-4">
                                <TabsContent value="HR" className="mt-0 space-y-4">
                                    {renderModuleList(filteredModulesByCategory["HR"])}
                                </TabsContent>
                                 <TabsContent value="Master" className="mt-0 space-y-0">
                                    <Tabs 
                                        value={masterFilter} 
                                        onValueChange={(val) => {
                                            setMasterFilter(val as any);
                                            setSearchTerm("");
                                        }}
                                        className="w-full"
                                    >
                                        <TabsList className="bg-muted/20 w-full grid grid-cols-4 mb-3 h-8 p-0.5">
                                            <TabsTrigger value="All" className="text-[11px] py-1">All Master</TabsTrigger>
                                            <TabsTrigger value="HR" className="text-[11px] py-1">HR Master</TabsTrigger>
                                            <TabsTrigger value="ERP" className="text-[11px] py-1">ERP Master</TabsTrigger>
                                            <TabsTrigger value="POS" className="text-[11px] py-1">POS Master</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value={masterFilter} className="mt-0 space-y-4">
                                            {renderModuleList(
                                                filteredModulesByCategory["Master"].filter(m => 
                                                    masterFilter === "All" || getMasterSubCategory(m) === masterFilter
                                                )
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </TabsContent>
                                <TabsContent value="ERP" className="mt-0 space-y-4">
                                    {renderModuleList(filteredModulesByCategory["ERP"])}
                                </TabsContent>
                                <TabsContent value="POS" className="mt-0 space-y-4">
                                    {renderModuleList(filteredModulesByCategory["POS"])}
                                </TabsContent>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </Tabs>
            </div>
        </div>

        <div className="flex justify-end space-x-4 border-t pt-6">
            <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {initialData ? "Update Role" : "Create Role"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
