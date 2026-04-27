import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance Management | HR Management System",
  description: "Manage employee attendance, view attendance records, track attendance requests, and manage attendance exemptions",
};

export default function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

