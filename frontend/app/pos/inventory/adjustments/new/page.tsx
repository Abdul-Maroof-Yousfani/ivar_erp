"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getLocationById } from "@/lib/actions/location";
import { getWarehouses, getWarehouseById } from "@/lib/actions/warehouse";
import { NewPosAdjustmentForm } from "./new-pos-adjustment-form";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewPosAdjustmentPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [warehouse, setWarehouse] = useState<{ id: string; name: string; code: string } | null>(null);
    const [location, setLocation] = useState<{ id: string; name: string; code: string } | null>(null);

    const locationId = user?.terminal?.location?.id || (user as any)?.locationId;

    useEffect(() => {
        const resolveLocationWarehouse = async () => {
            if (!locationId) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                let locData: { id: string; name: string; code: string; warehouseId?: string; warehouse?: any } | null = null;
                let whData: { id: string; name: string; code: string } | null = null;

                // 1. Fetch store location details
                const res = await getLocationById(locationId);
                if (res && res.status && res.data) {
                    locData = {
                        id: res.data.id,
                        name: res.data.name,
                        code: res.data.code,
                        warehouseId: (res.data as any).warehouseId,
                        warehouse: (res.data as any).warehouse,
                    };
                    setLocation(locData);

                    // 2. Check if location has a linked warehouse
                    if (locData.warehouse) {
                        whData = {
                            id: locData.warehouse.id,
                            name: locData.warehouse.name,
                            code: locData.warehouse.code,
                        };
                    } else if (locData.warehouseId) {
                        const linkedWh = await getWarehouseById(locData.warehouseId);
                        if (linkedWh) {
                            whData = {
                                id: linkedWh.id,
                                name: linkedWh.name,
                                code: linkedWh.code,
                            };
                        }
                    }
                } else {
                    toast.error("Failed to load store location context.");
                }

                // 3. Fallback: Fetch system active warehouses
                if (!whData) {
                    const warehouses = await getWarehouses();
                    if (Array.isArray(warehouses) && warehouses.length > 0) {
                        const activeWh = warehouses.find((w) => w.isActive) || warehouses[1];
                        if (activeWh) {
                            whData = {
                                id: activeWh.id,
                                name: activeWh.name,
                                code: activeWh.code,
                            };
                        }
                    }
                }

                if (whData) {
                    setWarehouse(whData);
                } else {
                    toast.error("No active warehouse could be linked to this location.");
                }
            } catch (error) {
                console.error("Error resolving location and warehouse context:", error);
                toast.error("An error occurred while resolving store location context.");
            } finally {
                setIsLoading(false);
            }
        };

        resolveLocationWarehouse();
    }, [locationId]);

    if (!locationId) {
        return (
            <div className="p-6 max-w-md mx-auto mt-20">
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6 text-center space-y-4">
                        <ShieldAlert className="mx-auto h-12 w-12 text-red-600 dark:text-red-400" />
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Terminal Context Required</h3>
                        <p className="text-sm text-red-600 dark:text-red-400">
                            Please log in from an authorized terminal session to create stock adjustments.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Resolving store & warehouse context...</p>
            </div>
        );
    }

    if (!location || !warehouse) {
        return (
            <div className="p-6 max-w-md mx-auto mt-20">
                <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="pt-6 text-center space-y-4">
                        <ShieldAlert className="mx-auto h-12 w-12 text-red-600 dark:text-red-400" />
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">
                            {!location ? "Location Context Required" : "No Warehouse Linked"}
                        </h3>
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {!location
                                ? "Could not resolve store location details for your session."
                                : "No active warehouse is linked to this outlet. Please ask an ERP administrator to configure a warehouse for this store."}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <NewPosAdjustmentForm 
                warehouse={warehouse} 
                location={location} 
            />
        </div>
    );
}
