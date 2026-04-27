import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exit Clearance | HR Management System",
  description: "Manage employee exit clearance, create exit clearance records, and handle employee separation processes",
};

export default function ExitClearanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

