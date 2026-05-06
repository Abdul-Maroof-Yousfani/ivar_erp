import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bonus Management | HR Management System",
  description: "Manage employee bonuses, create bonus records, and view bonus history",
};

export default function BonusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

