import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Holiday Management | HR Management System",
  description: "Manage company holidays, add new holidays, and view holiday calendar",
};

export default function HolidaysLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

