"use client";

import { JournalVoucher } from "./actions/journal-voucher";
import { ReceiptVoucher } from "./actions/receipt-voucher";
import { PaymentVoucher } from "./actions/payment-voucher";

// Singleton class to manage vouchers in the current browser session
class VoucherStore {
    private journalVouchers: JournalVoucher[] = [];
    private receiptVouchers: ReceiptVoucher[] = [];
    private paymentVouchers: PaymentVoucher[] = [];

    addJournalVoucher(jv: JournalVoucher) {
        // Check if already exists to avoid duplicates
        if (!this.journalVouchers.find(v => v.id === jv.id)) {
            this.journalVouchers.unshift(jv);
        }
    }

    getJournalVouchers(): JournalVoucher[] {
        return this.journalVouchers;
    }

    addReceiptVoucher(rv: ReceiptVoucher) {
        if (!this.receiptVouchers.find(v => v.id === rv.id)) {
            this.receiptVouchers.unshift(rv);
        }
    }

    getReceiptVouchers(): ReceiptVoucher[] {
        return this.receiptVouchers;
    }

    addPaymentVoucher(pv: PaymentVoucher) {
        if (!this.paymentVouchers.find(v => v.id === pv.id)) {
            this.paymentVouchers.unshift(pv);
        }
    }

    getPaymentVouchers(): PaymentVoucher[] {
        return this.paymentVouchers;
    }
}

// Create a singleton instance
export const voucherStore = new VoucherStore();
