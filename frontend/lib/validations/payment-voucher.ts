import { z } from "zod";

export const paymentVoucherDetailSchema = z.object({
    accountId: z.string().min(1, "Account is required"),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
});

export const paymentVoucherInvoiceSchema = z.object({
    purchaseInvoiceId: z.string().min(1, "Purchase Invoice is required"),
    paidAmount: z.coerce.number().min(0.01, "Paid amount must be greater than 0"),
});

export const paymentVoucherSchema = z.object({
    type: z.enum(["bank", "cash"]),
    isAdvance: z.boolean().default(false),
    pvNo: z.string().min(1, "PV Number is required"),
    pvDate: z.date({
        required_error: "PV Date is required",
    }),
    refBillNo: z.string().optional(),
    billDate: z.date().optional(),
    // Bank specific fields
    chequeNo: z.string().optional(),
    chequeDate: z.date().optional(),
    // Optional fields (not required anymore)
    creditAccountId: z.string().optional(),
    creditAmount: z.coerce.number().optional(),
    // Supplier and invoice linking
    supplierId: z.string().optional(),
    invoices: z.array(paymentVoucherInvoiceSchema).optional(),

    isTaxApplicable: z.boolean().default(false),
    description: z.string().min(1, "Description is required"),
    details: z.array(paymentVoucherDetailSchema).min(1, "At least one detail row is required"),
}).refine(data => {
    if (data.type === "bank") {
        return !!data.chequeNo && !!data.chequeDate;
    }
    return true;
}, {
    message: "Cheque details are required for Bank payments",
    path: ["chequeNo"],
}).refine(data => {
    const totalDebit = data.details.reduce((sum, item) => sum + (item.debit || 0), 0);
    const totalCredit = data.details.reduce((sum, item) => sum + (item.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
}, {
    message: "Total Debits must equal Total Credits and must be greater than 0",
    path: ["details"],
});

export type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;
