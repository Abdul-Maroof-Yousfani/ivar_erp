import { z } from "zod";

export const vendorSchema = z.object({
    type: z.enum(["local", "import"]),
    code: z.string().min(1, "Code is required"), // Common for both
    name: z.string().min(1, "Name is required"), // Common for both
    address: z.string().min(1, "Address is required"), // Common for both
    contactNo: z.string().optional(), // Common for both

    // Local Supplier Specific
    nature: z.string().optional(), // e.g., GOODS, SERVICES
    cnic: z.string().optional(),
    ntn: z.string().optional(),
    strn: z.string().optional(),
    srb: z.string().optional(),
    pra: z.string().optional(),
    ict: z.string().optional(),

    // Financial Linking
    chartOfAccountIds: z.array(z.string()).min(1, "At least one Chart of Account is required"),

    // Import Supplier Specific
    brand: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === "local") {
        if (!data.nature) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Nature is required for local suppliers",
                path: ["nature"],
            });
        }
    }
    if (data.type === "import") {
        if (!data.brand) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Brand is required for import suppliers",
                path: ["brand"],
            });
        }
    }
});

export type VendorFormValues = z.infer<typeof vendorSchema>;
