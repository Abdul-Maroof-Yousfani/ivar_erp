"use server";

import {
  getVoucherRegisterReport,
  queueVoucherRegisterExport,
  getVoucherRegisterExportStatus,
} from "@/lib/actions/pos-sales";

export {
  getVoucherRegisterReport,
  queueVoucherRegisterExport,
  getVoucherRegisterExportStatus,
};

export type VoucherRegisterReportData = any;
