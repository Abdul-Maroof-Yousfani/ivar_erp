"use client";

import { useRouter } from "next/navigation";
import { useTransition, startTransition, addTransitionType } from "react";
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
import { createHsCode } from "@/lib/actions/hs-code";
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

export default function AddHsCodePage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

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

    function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            const result = await createHsCode(values);
            if (result.status) {
                toast.success("HS Code created successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/master/hs-code/list");
                });
            } else {
                toast.error(result.message || "Failed to create HS code");
            }
        });
    }

    return (
        <PermissionGuard permissions="master.hs-code.create">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                    <Link href="/master/hs-code/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to List
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add HS Code</CardTitle>
                        <CardDescription>
                            Create a new Harmonized System Code with its associated tax percentages.
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
                                        Create HS Code
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            startTransition(() => {
                                                addTransitionType("nav-back");
                                                router.back();
                                            });
                                        }}
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
