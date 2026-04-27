import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Employee Management | HR Management System",
  description: "Manage employees, create new employee records, view employee details, and handle employee-related operations",
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

