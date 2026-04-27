import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loan Requests | HR Management System",
  description: "Manage employee loan requests, create new loan requests, view loan history, and handle loan approvals",
};

export default function LoanRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

