"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useTransition, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { getHsCodeById, updateHsCode, HsCode } from "@/lib/actions/hs-code";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { PermissionGuard } from "@/components/auth/permission-guard";

const formSchema = z.object({
    hsCode: z.string().min(1, "HS Code is required"),
    customsDutyCd: z.coerce.number().min(0).default(0),
    regulatoryDutyRd: z.coerce.number().min(0).default(0),
    additionalCustomsDutyAcd: z.coerce.number().min(0).default(0),
    salesTax: z.coerce.number().min(0).default(0),
    additionalSalesTax: z.coerce.number().min(0).default(0),
    incomeTax: z.coerce.number().min(0).default(0),
    status: z.string().default("active"),
});

export default function EditHsCodePage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [isPending, startTransition] = useTransition();
    const [loading, setLoading] = useState(true);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            hsCode: "",
            customsDutyCd: 0,
            regulatoryDutyRd: 0,
            additionalCustomsDutyAcd: 0,
            salesTax: 0,
            additionalSalesTax: 0,
            incomeTax: 0,
            status: "active",
        },
    });

    useEffect(() => {
        async function fetchHsCode() {
            const result = await getHsCodeById(id);
            if (result.status && result.data) {
                form.reset({
                    hsCode: result.data.hsCode,
                    customsDutyCd: Number(result.data.customsDutyCd),
                    regulatoryDutyRd: Number(result.data.regulatoryDutyRd),
                    additionalCustomsDutyAcd: Number(result.data.additionalCustomsDutyAcd),
                    salesTax: Number(result.data.salesTax),
                    additionalSalesTax: Number(result.data.additionalSalesTax),
                    incomeTax: Number(result.data.incomeTax),
                    status: result.data.status,
                });
            } else {
                toast.error("Failed to load HS code details");
                router.push("/master/hs-code/list");
            }
            setLoading(false);
        }
        fetchHsCode();
    }, [id, form, router]);

    function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            const result = await updateHsCode(id, values);
            if (result.status) {
                toast.success("HS Code updated successfully");
                router.push("/master/hs-code/list");
            } else {
                toast.error(result.message || "Failed to update HS code");
            }
        });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <PermissionGuard permissions="master.hs-code.update">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                    <Link href="/master/hs-code/list">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Edit HS Code</CardTitle>
                        <CardDescription>
                            Update Harmonized System Code details and tax percentages.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="hsCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>HS Code</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. 1006.30" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="customsDutyCd"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Customs Duty (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="regulatoryDutyRd"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Regulatory Duty (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="additionalCustomsDutyAcd"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Additional Customs Duty (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="salesTax"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Sales Tax (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="additionalSalesTax"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Additional Sales Tax (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="incomeTax"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Income Tax (%)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button type="submit" disabled={isPending}>
                                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Update HS Code
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => router.back()}
                                        disabled={isPending}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </PermissionGuard>
    );
}
