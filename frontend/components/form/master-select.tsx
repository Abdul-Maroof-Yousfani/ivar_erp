"use client";

import { Autocomplete } from "@/components/ui/autocomplete";
import { FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { ControllerRenderProps } from "react-hook-form";

interface MasterSelectProps {
    label: string;
    placeholder?: string;
    options: { id: string; name: string }[];
    field: ControllerRenderProps<any, any>;
    onCreateOption?: (newValue: string) => void;
    disabled?: boolean;
}

export function MasterSelect({
    label,
    placeholder = "Select...",
    options,
    field,
    onCreateOption,
    disabled,
}: MasterSelectProps) {
    // Map options to Autocomplete format
    const autocompleteOptions = options.map(opt => ({
        value: opt.id,
        label: opt.name
    }));

    return (
        <FormItem className="flex flex-col">
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <Autocomplete
                    options={autocompleteOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={placeholder}
                    onCreate={onCreateOption}
                    disabled={disabled}
                />
            </FormControl>
            <FormMessage />
        </FormItem>
    );
}
