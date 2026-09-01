"use server";

import {
  getGiftVoucherSaleRegisterReport,
  queueGiftVoucherSaleRegisterExport,
  getGiftVoucherSaleRegisterExportStatus,
} from "@/lib/actions/pos-sales";

export {
  getGiftVoucherSaleRegisterReport,
  queueGiftVoucherSaleRegisterExport,
  getGiftVoucherSaleRegisterExportStatus,
};

export type GiftVoucherSaleRegisterReportData = any;
