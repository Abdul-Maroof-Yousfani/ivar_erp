import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Allowance Management | HR Management System",
  description: "Manage employee allowances, create allowance records, and view allowance history",
};

export default function AllowanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

