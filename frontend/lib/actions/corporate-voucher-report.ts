"use server";

import {
  getCorporateVoucherReport,
  queueCorporateVoucherExport,
  getCorporateVoucherExportStatus,
} from "@/lib/actions/pos-sales";

export {
  getCorporateVoucherReport,
  queueCorporateVoucherExport,
  getCorporateVoucherExportStatus,
};

export type CorporateVoucherReportData = any;
