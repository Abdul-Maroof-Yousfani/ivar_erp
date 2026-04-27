"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createChartOfAccount, updateChartOfAccount, ChartOfAccount } from "@/lib/actions/chart-of-account";
import { useState } from "react";

const formSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  parentId: z.string().optional().nullable(),
  isGroup: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

interface ChartOfAccountFormProps {
  initialData?: ChartOfAccount;
  accounts: ChartOfAccount[];
}

export function ChartOfAccountForm({ initialData, accounts }: ChartOfAccountFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      code: initialData?.code || "",
      name: initialData?.name || "",
      type: initialData?.type || "",
      parentId: initialData?.parentId || "none", // Use "none" for select placeholder if needed or null
      isGroup: initialData?.isGroup || false,
      isActive: initialData?.isActive ?? true,
      description: initialData?.description || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const payload = {
        ...values,
        parentId: values.parentId === "none" || values.parentId === "" ? null : values.parentId,
      };

      let res;
      if (initialData) {
        res = await updateChartOfAccount(initialData.id, payload);
      } else {
        res = await createChartOfAccount(payload);
      }

      if (res.status) {
        toast.success(res.message);
        router.push("/erp/finance/chart-of-accounts");
      } else {
        toast.error(res.message || "Something went wrong");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  // Filter out self from parent options if editing
  const parentOptions = accounts.filter((acc) => !initialData || acc.id !== initialData.id);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 1001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Cash in Hand" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ASSET">Asset</SelectItem>
                    <SelectItem value="LIABILITY">Liability</SelectItem>
                    <SelectItem value="EQUITY">Equity</SelectItem>
                    <SelectItem value="REVENUE">Revenue</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Account</FormLabel>
                <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent account (optional)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {parentOptions.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex gap-4">
            <FormField
            control={form.control}
            name="isGroup"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                    <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>Is Group</FormLabel>
                    <FormDescription>
                    This account can contain sub-accounts.
                    </FormDescription>
                </div>
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                    <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>Is Active</FormLabel>
                    <FormDescription>
                    Disable to hide from selection.
                    </FormDescription>
                </div>
                </FormItem>
            )}
            />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Optional description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : initialData ? "Update Account" : "Create Account"}
        </Button>
      </form>
    </Form>
  );
}
