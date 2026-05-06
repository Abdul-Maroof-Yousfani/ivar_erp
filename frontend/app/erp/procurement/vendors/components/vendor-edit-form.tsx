"use client";

import { updateVendor } from "@/lib/actions/procurement";
import { getChartOfAccounts, ChartOfAccount } from "@/lib/actions/chart-of-account";
import { useState, useEffect, startTransition, addTransitionType } from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendorSchema, type VendorFormValues } from "@/lib/validations/vendor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Globe, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { MultiSelect } from "@/components/ui/multi-select";

interface VendorEditFormProps {
    vendor: any;
    accounts: ChartOfAccount[];
}

export function VendorEditForm({ vendor, accounts }: VendorEditFormProps) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);

    const form = useForm<VendorFormValues>({
        resolver: zodResolver(vendorSchema) as any,
        defaultValues: {
            type: vendor.type === "LOCAL" ? "local" : "import",
            code: vendor.code || "",
            name: vendor.name || "",
            address: vendor.address || "",
            contactNo: vendor.contactNo || "",
            nature: vendor.nature || undefined,
            cnic: vendor.cnicNo || "",
            ntn: vendor.ntnNo || "",
            strn: vendor.strnNo || "",
            srb: vendor.srbNo || "",
            pra: vendor.praNo || "",
            ict: vendor.ictNo || "",
            brand: vendor.brand || "",
            chartOfAccountIds: vendor.chartOfAccounts ? vendor.chartOfAccounts.map((acc: any) => acc.id) : (vendor.chartOfAccountId ? [vendor.chartOfAccountId] : []),
        },
    });

    const vendorType = form.watch("type");

    const onSubmit: SubmitHandler<VendorFormValues> = async (values) => {
        try {
            setIsPending(true);
            const result = await updateVendor(vendor.id, values);
            if (result.status) {
                toast.success(result.message);
                router.push("/erp/procurement/vendors");
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="space-y-4">
            <Button variant="ghost" onClick={() => {
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.back();
                });
            }} className="pl-0">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to List
            </Button>

            <Card className="w-full">
                <CardHeader className="border-b flex flex-row items-center justify-between">
                    <CardTitle>Edit Vendor</CardTitle>
                    <Tabs value={vendorType} onValueChange={(val) => form.setValue("type", val as "local" | "import")} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="local" className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Local
                            </TabsTrigger>
                            <TabsTrigger value="import" className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Import
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                        {/* Basic Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Code <span className="text-destructive">*</span></Label>
                                <Input {...form.register("code")} placeholder="Enter Supplier Code" />
                                {form.formState.errors.code && (
                                    <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Name of Supplier <span className="text-destructive">*</span></Label>
                                <Input {...form.register("name")} placeholder="Enter Supplier Name" />
                                {form.formState.errors.name && (
                                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Address <span className="text-destructive">*</span></Label>
                            <Textarea {...form.register("address")} placeholder="Enter Address" />
                            {form.formState.errors.address && (
                                <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Contact Number</Label>
                                <Input {...form.register("contactNo")} placeholder="Enter Contact Number" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Chart of Account <span className="text-destructive">*</span></Label>
                            <Controller
                                control={form.control}
                                name="chartOfAccountIds"
                                render={({ field }) => (
                                    <MultiSelect
                                        options={accounts.map((acc) => ({
                                            value: acc.id,
                                            label: `${acc.code} - ${acc.name}`,
                                        }))}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder="Select Accounts"
                                        searchPlaceholder="Search accounts..."
                                    />
                                )}
                            />
                            {form.formState.errors.chartOfAccountIds && (
                                <p className="text-xs text-destructive">{form.formState.errors.chartOfAccountIds.message}</p>
                            )}
                        </div>

                        {/* Tax & Registration Details - Common for Both */}
                        <div className="space-y-6 border-t pt-6">
                            <h3 className="text-lg font-semibold">Tax & Registration Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">CNIC No.</Label>
                                    <Input {...form.register("cnic")} placeholder="Enter CNIC" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">NTN No.</Label>
                                    <Input {...form.register("ntn")} placeholder="Enter NTN" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">STRN No.</Label>
                                    <Input {...form.register("strn")} placeholder="Enter STRN" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">SRB No.</Label>
                                    <Input {...form.register("srb")} placeholder="Enter SRB" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">PRA No.</Label>
                                    <Input {...form.register("pra")} placeholder="Enter PRA" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">ICT No.</Label>
                                    <Input {...form.register("ict")} placeholder="Enter ICT" />
                                </div>
                            </div>
                        </div>

                        {/* Local Supplier Specific Fields */}
                        {vendorType === "local" && (
                            <div className="space-y-6 border-t pt-6">
                                <h3 className="text-lg font-semibold">Local Consignment Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Nature <span className="text-destructive">*</span></Label>
                                        <Controller
                                            control={form.control}
                                            name="nature"
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Nature" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="GOODS">Goods</SelectItem>
                                                        <SelectItem value="SERVICES">Services</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {form.formState.errors.nature && (
                                            <p className="text-xs text-destructive">{form.formState.errors.nature.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Import Supplier Specific Fields */}
                        {vendorType === "import" && (
                            <div className="space-y-6 border-t pt-6">
                                <h3 className="text-lg font-semibold">Import Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Brand <span className="text-destructive">*</span></Label>
                                        <Input {...form.register("brand")} placeholder="e.g. NIKE, ADIDAS" />
                                        {form.formState.errors.brand && (
                                            <p className="text-xs text-destructive">{form.formState.errors.brand.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-6 border-t font-primary">
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Supplier
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
