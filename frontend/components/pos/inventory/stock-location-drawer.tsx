"use client";

import React, { useState, useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, MapPin, Package, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RequestStockModal } from "@/components/pos/inventory/request-stock-modal";
import { inventoryApi } from "@/lib/api";

interface StockLocation {
    id: string;
    quantity: number;
    location: {
        id: string;
        name: string;
        warehouse: {
            id: string;
            name: string;
            type: string;
        };
    };
}

interface StockLocationDrawerProps {
    item: {
        id: string;
        sku: string;
        description: string;
        totalQuantity: number;
    } | null;
    isOpen: boolean;
    onClose: () => void;
}

export function StockLocationDrawer({
    item,
    isOpen,
    onClose,
}: StockLocationDrawerProps) {
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<StockLocation | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen && item) {
            fetchStockDetails();
        }
    }, [isOpen, item]);

    async function fetchStockDetails() {
        if (!item) return;
        setIsLoading(true);
        try {
            const res = await inventoryApi.getDetails(item.id);
            if (res.status && res.data) {
                setLocations(res.data);
            }
        } catch (error) {
            console.error("Failed to fetch stock details", error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleRequestStock = (loc: StockLocation) => {
        setSelectedLocation(loc);
        setIsRequestModalOpen(true);
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="sm:max-w-md flex flex-col p-0 border-l border-border/50 gap-0">
                    <SheetHeader className="p-6 border-b bg-muted/30 backdrop-blur-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Package className="w-5 h-5" />
                            </div>
                            <SheetTitle className="text-xl font-bold tracking-tight">Stock Breakdown</SheetTitle>
                        </div>
                        <SheetDescription className="text-muted-foreground font-medium">
                            <span className="font-bold text-foreground">{item?.sku}</span>
                            <br />
                            {item?.description}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="p-4 bg-primary/5 border-b border-border/50 flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Total Available</span>
                            <Badge variant="default" className="text-xs px-3 font-mono">
                                {item?.totalQuantity} Units
                            </Badge>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-4 flex flex-col gap-4">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/50">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                        <p className="text-xs font-medium">Fetching location stock...</p>
                                    </div>
                                ) : locations.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <MapPin className="w-12 h-12 mx-auto mb-3 text-muted/30" />
                                        <p className="text-sm font-medium">No stock found in any location</p>
                                    </div>
                                ) : (
                                    locations.map((loc) => (
                                        <div
                                            key={loc.id}
                                            className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-3">
                                                    <div className="p-2 bg-muted rounded-lg text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-foreground text-sm tracking-tight">
                                                            {loc.location.warehouse.name}
                                                        </h4>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">
                                                            <MapPin className="h-3 w-3 text-primary/70" />
                                                            {loc.location.name}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="font-mono text-[10px] text-primary bg-primary/5 border-primary/20">
                                                    {loc.quantity} Qty
                                                </Badge>
                                            </div>

                                            <Separator className="my-3 opacity-30" />

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-between hover:bg-primary hover:text-primary-foreground group-hover:border-transparent transition-all duration-300"
                                                onClick={() => handleRequestStock(loc)}
                                            >
                                                <span className="text-xs font-bold uppercase tracking-wider">Request Transfer</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </SheetContent>
            </Sheet>

            {selectedLocation && (
                <RequestStockModal
                    item={item}
                    fromLocation={selectedLocation}
                    isOpen={isRequestModalOpen}
                    onClose={() => setIsRequestModalOpen(false)}
                />
            )}
        </>
    );
}
