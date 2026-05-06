"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface UserRow {
  id: string;
  roleId?: string | null;
  name: string;
  email: string;
  roleName: string;
  employeeName: string;
  department: string;
  designation: string;
  status: string;
}

export const columns: ColumnDef<UserRow>[] = [];
