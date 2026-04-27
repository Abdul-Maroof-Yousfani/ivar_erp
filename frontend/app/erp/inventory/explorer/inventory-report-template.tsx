"use client";

import { Warehouse, WarehouseLocation } from '@/lib/api';
import { format } from 'date-fns';

interface MatrixRow {
    id: string;
    sku: string;
    name: string;
    stockByLoc: Record<string, number>;
    warehouseStock: number;
}

export function InventoryReportTemplate({ 
    warehouse, 
    locations, 
    matrixData 
}: { 
    warehouse: Warehouse | undefined, 
    locations: WarehouseLocation[], 
    matrixData: MatrixRow[] 
}) {
    return (
        <div className="bg-white p-8 w-full mx-auto text-[12px] leading-tight font-sans">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-indigo-600 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-indigo-700 italic">Speed (Pvt.) Limited</h1>
                    <h2 className="text-lg font-bold mt-1">Inventory Matrix Report</h2>
                </div>
                <div className="text-right">
                    <p className="font-bold text-lg">{warehouse?.name || 'All Warehouses'}</p>
                    <p>Date: {format(new Date(), "dd-MMM-yyyy")}</p>
                </div>
            </div>

            {/* Matrix Table */}
            <table className="w-full border-collapse border border-gray-300">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left min-w-[200px]">Item Description</th>
                        <th className="border border-gray-300 p-2 text-center min-w-[100px] bg-blue-50">
                            <div className="flex flex-col items-center gap-1">
                                <span className="font-bold">Warehouse</span>
                                <span className="text-[10px] text-gray-500 uppercase">(BULK)</span>
                            </div>
                        </th>
                        {locations.map(loc => (
                            <th key={loc.id} className="border border-gray-300 p-2 text-center min-w-[100px]">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="font-bold">{loc.name}</span>
                                    <span className="text-[10px] text-gray-500 uppercase">({loc.type})</span>
                                </div>
                            </th>
                        ))}
                        <th className="border border-gray-300 p-2 text-center bg-gray-200 font-bold min-w-[100px]">Total Stock</th>
                    </tr>
                </thead>
                <tbody>
                    {matrixData.length === 0 ? (
                        <tr>
                            <td colSpan={locations.length + 3} className="border border-gray-300 p-8 text-center text-gray-500">
                                No stock data found for the selected criteria.
                            </td>
                        </tr>
                    ) : (
                        matrixData.map((row) => {
                            let totalRow = row.warehouseStock; // Start with warehouse stock
                            return (
                                <tr key={row.id}>
                                    <td className="border border-gray-300 p-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm tracking-tight">{row.sku}</span>
                                            <span className="text-[10px] text-gray-600 truncate max-w-[250px]">{row.name}</span>
                                        </div>
                                    </td>
                                    {/* Warehouse Stock Column */}
                                    <td className={`border border-gray-300 p-2 text-center bg-blue-50/50 ${row.warehouseStock > 0 ? 'font-semibold text-blue-600' : 'text-gray-300'}`}>
                                        {row.warehouseStock > 0 ? row.warehouseStock.toLocaleString() : '0'}
                                    </td>
                                    {/* Location Stock Columns */}
                                    {locations.map(loc => {
                                        const qty = Number(row.stockByLoc[loc.id] || 0);
                                        totalRow += qty;
                                        return (
                                            <td key={loc.id} className={`border border-gray-300 p-2 text-center ${qty > 0 ? 'font-semibold' : 'text-gray-300'}`}>
                                                {qty > 0 ? qty.toLocaleString() : '0'}
                                            </td>
                                        );
                                    })}
                                    <td className="border border-gray-300 p-2 text-center font-bold bg-gray-50">
                                        {totalRow.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-end">
                <div className="text-[10px] text-gray-400 italic">
                    <p>Generated by: Inventory Explorer System</p>
                    <p>Generated on: {format(new Date(), "PPpp")}</p>
                </div>
                <div className="text-center w-48">
                    <div className="border-t border-gray-400 pt-1 text-[10px]">Authorized Signature</div>
                </div>
            </div>
            
            <div className="mt-4 text-center">
                <p className="text-[10px] text-red-600 italic font-medium">
                    Note: This is a system generated document. Thank You!
                </p>
            </div>
        </div>
    );
}
