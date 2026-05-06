import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payroll Management | HR Management System",
  description: "Generate payroll, view payslips, manage payroll reports, and handle all payroll-related operations",
};

export default function PayrollLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

