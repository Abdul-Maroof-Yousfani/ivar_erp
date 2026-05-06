import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Working Hours Management | HR Management System",
  description: "Manage working hours policies, assign policies to employees, and view working hours configurations",
};

export default function WorkingHoursLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

