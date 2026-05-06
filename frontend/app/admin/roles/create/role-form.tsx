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
import { Loader2, Check, Shield } from "lucide-react";
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
    const modulePermissions = groupedPermissions[module].map(p => p.id);
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
              <div className="text-center py-8 text-muted-foreground">
                  No modules found in this category.
              </div>
          )}
          {categoryModules.map((module) => {
              const perms = groupedPermissions[module];
              const allSelected = perms.every(p => selectedPermissionIds.includes(p.id));
              const someSelected = perms.some(p => selectedPermissionIds.includes(p.id));

              return (
                  <div key={module} className="space-y-2 border rounded-lg p-4 bg-card/50">
                      <div className="flex items-center space-x-2 mb-2">
                          <Checkbox 
                              id={`module-${module}`}
                              checked={allSelected ? true : someSelected ? "indeterminate" : false}
                              onCheckedChange={(checked) => handleModuleSelect(module, !!checked)}
                          />
                          <label htmlFor={`module-${module}`} className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize">
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
                      <div className="ml-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {perms.map((permission) => (
                              <FormField
                                  key={permission.id}
                                  control={form.control}
                                  name="permissionIds"
                                  render={({ field }) => (
                                      <FormItem
                                          key={permission.id}
                                          className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                          <FormControl>
                                              <Checkbox
                                                  checked={field.value?.includes(permission.id)}
                                                  onCheckedChange={(checked) => {
                                                      return checked
                                                          ? field.onChange([...field.value, permission.id])
                                                          : field.onChange(
                                                              field.value?.filter(
                                                                  (value) => value !== permission.id
                                                              )
                                                          )
                                                  }}
                                              />
                                          </FormControl>
                                          <FormLabel className="font-normal text-xs cursor-pointer">
                                              {permission.action}
                                          </FormLabel>
                                      </FormItem>
                                  )}
                              />
                          ))}
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
                <Card>
                    <CardHeader>
                        <CardTitle>Role Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Role Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. HR Manager" {...field} />
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
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the role's responsibilities" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </CardContent>
                </Card>

                {/* Permissions Summary Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Permissions Summary
                        </CardTitle>
                        <CardDescription>Overview of assigned permissions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {(["HR", "Master", "ERP", "POS"] as const).map((cat) => {
                            const count = getSelectedCount(cat);
                            const total = getTotalCount(cat);
                            return (
                                <div key={cat} className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{cat}</span>
                                        <span className="text-muted-foreground">{count} / {total}</span>
                                    </div>
                                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-primary transition-all duration-300" 
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
                <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
                            <TabsList className="grid w-[400px] grid-cols-4">
                                <TabsTrigger value="HR">HR</TabsTrigger>
                                <TabsTrigger value="Master">Master</TabsTrigger>
                                <TabsTrigger value="ERP">ERP</TabsTrigger>
                                <TabsTrigger value="POS">POS</TabsTrigger>
                            </TabsList>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectAllInCategory(activeTab, true)}
                                >
                                    Select All
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSelectAllInCategory(activeTab, false)}
                                >
                                    Deselect All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <ScrollArea className="h-[490px] pr-4">
                                <TabsContent value="HR" className="mt-0 space-y-4">
                                    {renderModuleList(modulesByCategory["HR"])}
                                </TabsContent>
                                 <TabsContent value="Master" className="mt-0 space-y-0">
                                    <Tabs 
                                        value={masterFilter} 
                                        onValueChange={(val) => setMasterFilter(val as any)}
                                        className="w-full"
                                    >
                                        <TabsList className="bg-muted/20 w-full grid grid-cols-4 mb-2">
                                            <TabsTrigger value="All" className="text-xs">All Master</TabsTrigger>
                                            <TabsTrigger value="HR" className="text-xs">HR Master</TabsTrigger>
                                            <TabsTrigger value="ERP" className="text-xs">ERP Master</TabsTrigger>
                                            <TabsTrigger value="POS" className="text-xs">POS Master</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value={masterFilter} className="mt-0 space-y-4">
                                            {renderModuleList(
                                                modulesByCategory["Master"].filter(m => 
                                                    masterFilter === "All" || getMasterSubCategory(m) === masterFilter
                                                )
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                </TabsContent>
                                <TabsContent value="ERP" className="mt-0 space-y-4">
                                    {renderModuleList(modulesByCategory["ERP"])}
                                </TabsContent>
                                <TabsContent value="POS" className="mt-0 space-y-4">
                                    {renderModuleList(modulesByCategory["POS"])}
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
