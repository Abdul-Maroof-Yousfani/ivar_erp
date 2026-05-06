import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave Management | HR Management System",
  description: "Manage employee leaves, create leave requests, view leave history, and handle leave-related operations",
};

export default function LeavesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

