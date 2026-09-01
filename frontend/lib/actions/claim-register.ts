"use server";

import {
  getClaimRegisterReport,
  queueClaimRegisterReportExport,
  getClaimRegisterReportExportStatus,
} from "@/lib/actions/pos-sales";

export {
  getClaimRegisterReport,
  queueClaimRegisterReportExport,
  getClaimRegisterReportExportStatus,
};

export type ClaimRegisterReportData = any;
