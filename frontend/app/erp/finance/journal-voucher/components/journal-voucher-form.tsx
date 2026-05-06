"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { journalVoucherSchema, type JournalVoucherFormValues } from "@/lib/validations/journal-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createJournalVoucher, type JournalVoucher } from "@/lib/actions/journal-voucher";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";


export function JournalVoucherForm({ accounts }: { accounts: ChartOfAccount[] }) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);

    const form = useForm<JournalVoucherFormValues>({
        resolver: zodResolver(journalVoucherSchema) as any,
        defaultValues: {
            jvNo: `JV${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
            jvDate: new Date(),
            description: "",
            details: [
                { accountId: "", debit: 0, credit: 0 },
                { accountId: "", debit: 0, credit: 0 },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "details",
    });

    const onSubmit: SubmitHandler<JournalVoucherFormValues> = async (values) => {
        try {
            setIsPending(true);
            const result = await createJournalVoucher(values);
            if (result.status) {
                // Client-side state update is not needed as we revalidate path
                // and redirect to list which fetches fresh data

                toast.success("Journal Voucher created successfully");
                router.push("/finance/journal-voucher/list");
            } else {
                toast.error(result.message || "Failed to create Journal Voucher");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    const watchDetails = form.watch("details") || [];
    const totalDebit = watchDetails.reduce((sum, detail) => sum + (Number(detail.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum, detail) => sum + (Number(detail.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return (
        <Card className="w-full">
            <CardHeader className="border-b">
                <CardTitle>Create Journal Voucher Form</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <Label htmlFor="jvNo" className="text-xs text-muted-foreground uppercase font-semibold">JV No <span className="text-destructive">*</span></Label>
                            <Input
                                id="jvNo"
                                {...form.register("jvNo")}
                                disabled
                                className="bg-gray-100 dark:bg-muted h-11 border-gray-300 dark:border-input pointer-events-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">JV Date. <span className="text-destructive">*</span></Label>
                            <Controller
                                control={form.control}
                                name="jvDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value ? field.value.toISOString().split('T')[0] : ""}
                                        onChange={(dateStr) => field.onChange(new Date(dateStr))}
                                        disabled={isPending}
                                        className="h-11 border-gray-300 dark:border-input"
                                    />
                                )}
                            />
                            {form.formState.errors.jvDate && (
                                <p className="text-xs text-destructive">{form.formState.errors.jvDate.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">Journal Voucher Detail</h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => append({ accountId: "", debit: 0, credit: 0 })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add More JV Rows
                                </Button>
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-border">
                            <table className="w-full text-sm">
                                <thead className="dark:bg-muted text-foreground border-b font-bold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Account Head</th>
                                        <th className="px-4 py-3 text-left w-[180px]">Debit <span className="text-destructive">*</span></th>
                                        <th className="px-4 py-3 text-left w-[180px]">Credit <span className="text-destructive">*</span></th>
                                        <th className="px-4 py-3 text-center w-[80px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {fields.map((field, index) => (
                                        <tr key={field.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/50">
                                            <td className="px-4 py-3">
                                                <Controller
                                                    control={form.control}
                                                    name={`details.${index}.accountId`}
                                                    render={({ field }) => (
                                                        <Autocomplete
                                                            options={accounts.map((acc) => ({
                                                                value: acc.id,
                                                                label: `${acc.code} - ${acc.name}`,
                                                            }))}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select Account"
                                                            disabled={isPending}
                                                            className="h-10 border-gray-300 dark:border-input"
                                                        />
                                                    )}
                                                />
                                                {form.formState.errors.details?.[index]?.accountId && (
                                                    <p className="text-[10px] text-destructive mt-1">
                                                        {form.formState.errors.details[index].accountId?.message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Debit"
                                                    {...form.register(`details.${index}.debit`, {
                                                        valueAsNumber: true,
                                                        onChange: (e) => {
                                                            if (Number(e.target.value) > 0) {
                                                                form.setValue(`details.${index}.credit`, 0, { shouldValidate: true });
                                                            }
                                                        }
                                                    })}
                                                    disabled={isPending}
                                                    className="h-10 border-gray-300 dark:border-input font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Credit"
                                                    {...form.register(`details.${index}.credit`, {
                                                        valueAsNumber: true,
                                                        onChange: (e) => {
                                                            if (Number(e.target.value) > 0) {
                                                                form.setValue(`details.${index}.debit`, 0, { shouldValidate: true });
                                                            }
                                                        }
                                                    })}
                                                    disabled={isPending}
                                                    className="h-10 border-gray-300 dark:border-input font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {fields.length > 2 ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => remove(index)}
                                                        disabled={isPending}
                                                        className="rounded-full"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <span className="text-gray-300">---</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="font-bold border-t border-gray-200 dark:border-border">
                                    <tr>
                                        <td className="px-4 py-4 text-right pr-8 text-gray-600 dark:text-muted-foreground">Totals:</td>
                                        <td className="px-4 py-4 text-right text-lg">
                                            {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-right text-lg">
                                            {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {!isBalanced && (
                                                <div className="mx-auto w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title="Out of Balance" />
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {form.formState.errors.details?.root && (
                            <p className="text-sm text-destructive font-medium">{form.formState.errors.details.root.message}</p>
                        )}
                    </div>

                    <div className="space-y-2 pt-4">
                        <Label htmlFor="description" className="text-xs text-muted-foreground uppercase font-semibold">Description <span className="text-destructive">*</span></Label>
                        <Textarea
                            id="description"
                            placeholder="Description"
                            {...form.register("description")}
                            disabled={isPending}
                            className="min-h-[100px] border-gray-300 dark:border-input rounded-lg"
                        />
                        {form.formState.errors.description && (
                            <p className="text-xs text-destructive font-medium">{form.formState.errors.description.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center pt-6 border-t">
                        <Button
                            type="submit"
                            disabled={isPending || !isBalanced || totalDebit === 0}
                        >
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create Journal Voucher
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
