import { z } from "zod";

export const taxTypeEnum = z.enum(["Taxable", "BTL", "REIMB", "Exempt", ""]);

export const paymentVoucherDetailSchema = z.object({
    accountId:    z.string().min(1, "Account is required"),
    tagAccountId: z.string().optional(),
    debit:        z.coerce.number().min(0).transform(v => Math.round(v)).default(0),
    credit:       z.coerce.number().min(0).transform(v => Math.round(v)).default(0),
    narration:    z.string().optional(),   // per-line narration
    refBillNo:    z.string().optional(),   // per-line bill ref
    refBillNo2:   z.string().optional(),
    taxType:      taxTypeEnum.default(""),
    taxableValue: z.coerce.number().optional().default(0), // base value for calculation
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
        message: "PV Date is required",
    }),
    refBillNo: z.string().optional(),
    billDate: z.date().optional(),
    // Bank specific fields (optional)
    chequeNo: z.string().optional(),
    chequeDate: z.date().optional(),
    // Optional fields (not required anymore)
    creditAccountId: z.string().optional(),
    creditAmount: z.coerce.number().transform(v => Math.round(v)).optional(),
    // Supplier and invoice linking
    supplierId: z.string().optional(),
    invoices: z.array(paymentVoucherInvoiceSchema).optional(),

    taxType: taxTypeEnum.default(""),
    description: z.string().optional(),
    details: z.array(paymentVoucherDetailSchema).min(1, "At least one detail row is required"),
}).refine(data => {
    const totalDebit = data.details.reduce((sum, item) => sum + (item.debit || 0), 0);
    const totalCredit = data.details.reduce((sum, item) => sum + (item.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
}, {
    message: "Total Debits must equal Total Credits and must be greater than 0",
    path: ["details"],
});

export type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;

