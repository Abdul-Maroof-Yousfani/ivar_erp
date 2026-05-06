"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createUser } from "@/lib/actions/users";
import { Role } from "@/lib/actions/roles";
import { EmployeeDropdownOption } from "@/lib/actions/employee";
import { Loader2, Check } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  roleId: z.string().optional(),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
});

interface UserAccountFormProps {
  employees: EmployeeDropdownOption[];
  roles: Role[];
}

export function UserAccountForm({ employees, roles }: UserAccountFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [employeeOpen, setEmployeeOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      email: "",
      password: "",
      roleId: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleEmployeeSelect = (employeeId: string) => {
      const employee = employees.find(e => e.id === employeeId);
      if (employee) {
          form.setValue("employeeId", employeeId);
          // Split name into first and last name roughly
          const nameParts = employee.employeeName.split(" ");
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(" ") || firstName; // Fallback if single name
          
          form.setValue("firstName", firstName);
          form.setValue("lastName", lastName);
          
          // Auto-fill email if available (prefer official, fallback to personal)
          const email = employee.officialEmail || employee.personalEmail;
          if (email) {
              form.setValue("email", email);
          } else {
              // Clear if no email to avoid confusion
              form.setValue("email", "");
          }

          // Auto-fill default password
          form.setValue("password", "Password@123");
      }
      setEmployeeOpen(false);
  }

  useEffect(() => {
    const employeeIdParam = searchParams.get("employeeId");
    if (employeeIdParam) {
        // Use setTimeout to ensure form is ready, though useEffect runs after render
        handleEmployeeSelect(employeeIdParam);
    }
  }, [searchParams, employees]); // Added dependencies

  async function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
        const result = await createUser(values);
        if (result.status) {
          toast.success("User account created successfully");
          router.push("/hr/employee/user-account");
          router.refresh();
        } else {
          toast.error(result.message);
        }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-2xl mx-auto">
        <Card>
            <CardHeader>
                <CardTitle>Create User Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Employee</FormLabel>
                    <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                            )}
                            >
                            {field.value
                                ? employees.find(
                                    (employee) => employee.id === field.value
                                )?.employeeName
                                : "Select employee"}
                            {/* <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /> */}
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                        <Command>
                            <CommandInput placeholder="Search employee..." />
                            <CommandList>
                                <CommandEmpty>No employee found.</CommandEmpty>
                                <CommandGroup>
                                {employees.map((employee) => (
                                    <CommandItem
                                    value={employee.employeeName}
                                    key={employee.id}
                                    onSelect={() => handleEmployeeSelect(employee.id)}
                                    >
                                    <Check
                                        className={cn(
                                        "mr-2 h-4 w-4",
                                        employee.id === field.value
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{employee.employeeName}</span>
                                        <span className="text-xs text-muted-foreground">{employee.employeeId} - {employee.designationName}</span>
                                    </div>
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                            <Input placeholder="First Name" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Last Name" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input placeholder="email@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Password (Optional)</FormLabel>
                    <FormControl>
                        <Input type="text" placeholder="Leave blank for default: Password@123" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Assign Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                            {role.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
            </Button>
        </div>
      </form>
    </Form>
  );
}
