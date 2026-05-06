import { z } from "zod";

export const journalVoucherDetailSchema = z.object({
    accountId: z.string().min(1, "Account is required"),
    debit: z.coerce.number().min(0),
    credit: z.coerce.number().min(0),
}).refine(data => (data.debit > 0 && data.credit === 0) || (data.credit > 0 && data.debit === 0), {
    message: "Either Debit or Credit must be greater than 0, but not both.",
    path: ["debit"],
});

export const journalVoucherSchema = z.object({
    jvNo: z.string().min(1, "JV Number is required"),
    jvDate: z.date(),
    description: z.string().min(1, "Description is required"),
    details: z.array(journalVoucherDetailSchema).min(2, "At least two entries are required (Debit and Credit)"),
}).refine(data => {
    const totalDebit = data.details.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = data.details.reduce((sum, item) => sum + item.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
}, {
    message: "Total Debits must equal Total Credits",
    path: ["details"],
});

export type JournalVoucherFormValues = z.infer<typeof journalVoucherSchema>;
