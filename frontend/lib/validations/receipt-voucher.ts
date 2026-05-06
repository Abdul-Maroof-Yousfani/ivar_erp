import { z } from "zod";

export const receiptVoucherDetailSchema = z.object({
    accountId: z.string().min(1, "Account is required"),
    debit: z.coerce.number().min(0).default(0),
    credit: z.coerce.number().min(0).default(0),
});

export const receiptVoucherInvoiceSchema = z.object({
    salesInvoiceId: z.string().min(1),
    receivedAmount: z.coerce.number().min(0.01),
});

export const receiptVoucherSchema = z.object({
    type: z.enum(["bank", "cash"]),
    rvNo: z.string().min(1, "RV Number is required"),
    rvDate: z.date(),
    refBillNo: z.string().optional(),
    billDate: z.date().optional(),
    chequeNo: z.string().optional(),
    chequeDate: z.date().optional(),
    customerId: z.string().optional(),
    invoices: z.array(receiptVoucherInvoiceSchema).optional(),
    description: z.string().min(1, "Description is required"),
    details: z.array(receiptVoucherDetailSchema).min(2, "At least two detail rows are required"),
}).refine(data => {
    if (data.type === "bank") return !!data.chequeNo && !!data.chequeDate;
    return true;
}, {
    message: "Cheque details are required for Bank receipts",
    path: ["chequeNo"],
}).refine(data => {
    const totalDebit = data.details.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = data.details.reduce((sum, item) => sum + item.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
}, {
    message: "Total Debits must equal Total Credits and be greater than 0",
    path: ["details"],
});

export type ReceiptVoucherFormValues = z.infer<typeof receiptVoucherSchema>;