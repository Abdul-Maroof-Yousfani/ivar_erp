"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import type { Equipment } from "@/lib/actions/equipment";
import { Textarea } from "@/components/ui/textarea";

interface EquipmentSectionProps {
    equipments: Equipment[];
    disabled?: boolean;
}

export function EquipmentSection({
    equipments,
    disabled,
}: EquipmentSectionProps) {
    const { control } = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control,
        name: "equipmentAssignments",
    });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle>Employee Items Issued</CardTitle>
                    <CardDescription>
                        Assign items and equipment to the employee
                    </CardDescription>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        append({
                            equipmentId: "",
                            productId: "",
                            assignedDate: new Date().toISOString(),
                            notes: "",
                        })
                    }
                    disabled={disabled}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {fields.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                        No items assigned. Click "Add Item" to assign equipment.
                    </div>
                )}
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        className="relative grid gap-4 rounded-lg border p-4 md:grid-cols-4"
                    >
                        <div className="absolute right-2 top-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                disabled={disabled}
                                className="h-8 w-8 text-destructive hover:text-destructive/90"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Equipment Type */}
                        <FormField
                            control={control}
                            name={`equipmentAssignments.${index}.equipmentId`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Item Type</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={disabled}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Item" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {equipments.map((equipment) => (
                                                <SelectItem key={equipment.id} value={equipment.id}>
                                                    {equipment.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Product ID / Asset Tag */}
                        <FormField
                            control={control}
                            name={`equipmentAssignments.${index}.productId`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Asset ID / Product ID</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="e.g. EQ-001" disabled={disabled} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Assigned Date */}
                        <FormField
                            control={control}
                            name={`equipmentAssignments.${index}.assignedDate`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assigned Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                    disabled={disabled}
                                                >
                                                    {field.value ? (
                                                        format(new Date(field.value), "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value ? new Date(field.value) : undefined}
                                                onSelect={(date) =>
                                                    field.onChange(date ? date.toISOString() : "")
                                                }
                                                disabled={(date) =>
                                                    date > new Date() || date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Notes */}
                        <FormField
                            control={control}
                            name={`equipmentAssignments.${index}.notes`}
                            render={({ field }) => (
                                <FormItem className="md:col-span-1">
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Condition, remarks..." disabled={disabled} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
