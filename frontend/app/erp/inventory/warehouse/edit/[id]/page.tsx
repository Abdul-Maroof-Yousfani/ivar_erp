'use client';

import { use } from 'react';
import { WarehouseForm } from '../../warehouse-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft, List, Building2, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseLocationManager } from '@/components/inventory/warehouse-location-manager';
import { PermissionGuard } from '@/components/auth/permission-guard';

export default function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    return (
        <PermissionGuard permissions="erp.inventory.warehouse.update">
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Edit Warehouse</h1>
                        <p className="text-muted-foreground">Update storage location details and configurations.</p>
                    </div>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/erp/inventory/warehouse">
                        <List className="h-4 w-4 mr-2" />
                        Warehouse List
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="details">
                        <Building2 className="h-4 w-4 mr-2" />
                        Details
                    </TabsTrigger>
                    <TabsTrigger value="locations">
                        <MapPin className="h-4 w-4 mr-2" />
                        Shop Locations
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-6">
                    <WarehouseForm id={id} />
                </TabsContent>

                <TabsContent value="locations" className="mt-6">
                    <WarehouseLocationManager warehouseId={id} />
                </TabsContent>
            </Tabs>
        </div>
        </PermissionGuard>
    );
}
