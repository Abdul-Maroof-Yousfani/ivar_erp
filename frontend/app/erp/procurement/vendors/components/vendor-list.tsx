"use client";

import { useState, useEffect } from "react";
import DataTable from "@/components/common/data-table";
import { columns, VendorRow } from "./vendor-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VendorListProps {
  initialVendors: VendorRow[];
}

export function VendorList({ initialVendors }: VendorListProps) {
  // Ensure each row has a string ID for the DataTable
  const formattedVendors = initialVendors.map(v => ({
    ...v,
    id: v.id.toString()
  }));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Vendors List</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={formattedVendors}
          searchFields={[
            { key: "name", label: "Name" },
            { key: "code", label: "Code" },
          ]}
          filters={[
            {
              key: "type",
              label: "Type",
              options: [
                { label: "Local", value: "LOCAL" },
                { label: "Import", value: "INTERNATIONAL" },
              ],
            },
          ]}
          tableId="vendor-list"
        />
      </CardContent>
    </Card>
  );
}
