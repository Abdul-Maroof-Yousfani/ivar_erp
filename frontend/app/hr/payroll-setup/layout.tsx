import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payroll Setup | HR Management System",
  description: "Configure payroll settings including increments, advances, deductions, allowances, overtime, and other payroll components",
};

export default function PayrollSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

