"use client";

import { useRouter } from "next/navigation";
import { useTransition, startTransition, addTransitionType } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createRebateNature } from "@/lib/actions/rebate-nature";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REBATE_TYPES = ["fixed", "other"] as const;
const REBATE_CATEGORIES = [
  "Education",
  "Consumer",
  "Banking",
  "Vehicle",
  "Telephone",
  "Property",
] as const;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["fixed", "other"]).optional(),
  category: z.string().optional(),
  maxInvestmentPercentage: z.coerce.number().min(0).optional(),
  maxInvestmentAmount: z.coerce.number().min(0).optional(),
  details: z.string().optional(),
  underSection: z.string().optional(),
  isAgeDependent: z.boolean().optional().default(false),
  status: z.string().optional().default("active"),
});

type FormSchemaType = {
  name: string;
  type?: "fixed" | "other";
  category?: string;
  maxInvestmentPercentage?: number;
  maxInvestmentAmount?: number;
  details?: string;
  underSection?: string;
  isAgeDependent?: boolean;
  status?: string;
};

export default function AddRebateNaturePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      type: "other",
      category: undefined,
      maxInvestmentPercentage: undefined,
      maxInvestmentAmount: undefined,
      details: "",
      underSection: "",
      isAgeDependent: false,
      status: "active",
    },
  });

  const selectedType = form.watch("type");

  const onSubmit = (values: FormSchemaType) => {
    startTransition(async () => {
      const result = await createRebateNature(values);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/rebate-nature/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Link href="/master/rebate-nature/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Create Rebate Nature</h1>
          <p className="text-muted-foreground">
            Configure a new tax rebate rule for employee salary calculations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rebate Configurations</CardTitle>
            <CardDescription>
              Define the limits and conditions for this tax rebate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Row 1: Basic Info */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Charitable Donation" {...field} disabled={isPending} />
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
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== "fixed") {
                              form.setValue("category", undefined);
                            }
                          }}
                          disabled={isPending}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {REBATE_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedType === "fixed" && (
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isPending}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {REBATE_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="underSection"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Under Section</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 61" {...field} disabled={isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  {/* Row 2: Investment Limits */}
                  <FormField
                    control={form.control}
                    name="maxInvestmentPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Invesment % (of Salary)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g. 20"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxInvestmentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Invesment Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g. 2000000"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Row 3: Flags */}
                  <FormField
                    control={form.control}
                    name="isAgeDependent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm md:col-span-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isPending}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Age Dependent Calculation
                          </FormLabel>
                          <FormDescription>
                            Enable if the rebate limits change based on the employee's age group (e.g., senior citizens).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Row 4: Details */}
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Additional Details</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter any additional rules or descriptions here..."
                            className="min-h-[100px] resize-none"
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
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
                  <Button type="submit" disabled={isPending} className="min-w-[150px]">
                    {isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Create Rebate Nature
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
