import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Package } from "lucide-react";
import Link from "next/link";
import { getItemById } from "@/lib/actions/items";
import { format } from "date-fns";
import { hasPermission } from "@/lib/auth";
import { AccessDenied } from "@/components/auth/access-denied";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ViewItemPage({ params }: PageProps) {
    const { id: itemId } = await params;

    const canRead = await hasPermission("erp.item.read");
    if (!canRead) <AccessDenied/>;

    const result = await getItemById(itemId);

    if (!result || !result.status || !result.data) {
        notFound();
    }

    const item = result.data;

    const InfoSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {children}
                </div>
            </CardContent>
        </Card>
    );

    const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="text-sm font-semibold">{value || "N/A"}</div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-[90%] mx-auto pb-10">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/erp/items/list" transitionTypes={["nav-back"]}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Item Details</h1>
                        <p className="text-muted-foreground">View item information</p>
                    </div>
                </div>
                <Link href={`/erp/items/edit/${itemId}`} transitionTypes={["nav-forward"]}>
                    <Button>
                        <Edit className="mr-2 h-4 w-4" /> Edit Item
                    </Button>
                </Link>            </div>

            <Card className="border-none shadow-none">
                <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <Package className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">{item.itemId}</CardTitle>
                            <CardDescription className="text-base mt-1">
                                {item.sku}
                            </CardDescription>
                            <div className="mt-2">
                                <Badge variant={item.isActive ? "default" : "secondary"}>
                                    {item.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Image Display Section */}
            {item.imageUrl && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Item Image</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-center">
                            <img
                                src={item.imageUrl}
                                alt={item.itemId}
                                className="max-w-md w-full h-auto rounded-lg border shadow-sm object-contain"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            <InfoSection title="Basic Details">
                <InfoItem label="Description" value={item.description} />
                <InfoItem label="Brand" value={item.brand?.name} />
                <InfoItem label="Segment" value={item.segment?.name} />
                <InfoItem label="Barcode" value={item.barCode} />
                <InfoItem label="HS Code" value={item.hsCode} />
            </InfoSection>

            <InfoSection title="Classification">
                <InfoItem label="Division" value={item.division?.name} />
                <InfoItem label="Category" value={item.category?.name} />
                <InfoItem label="Sub Category" value={item.subCategory?.name} />
                <InfoItem label="Item Class" value={item.itemClass?.name} />
                <InfoItem label="Item Subclass" value={item.itemSubclass?.name} />
                <InfoItem label="Channel Class" value={item.channelClass?.name} />
                <InfoItem label="Gender" value={item.gender?.name} />
                <InfoItem label="Season" value={item.season?.name} />
                {/* UOM removed */}
            </InfoSection>

            <InfoSection title="Pricing & Discounts">
                <InfoItem label="Unit Price" value={item.unitPrice} />
                <InfoItem label="Tax Rate 1" value={item.taxRate1 ? `${item.taxRate1}%` : null} />
                <InfoItem label="Tax Rate 2" value={item.taxRate2 ? `${item.taxRate2}%` : null} />
                <InfoItem label="Discount Rate" value={item.discountRate ? `${item.discountRate}%` : null} />
                <InfoItem label="Discount Amount" value={item.discountAmount} />
                <InfoItem
                    label="Discount Start Date"
                    value={item.discountStartDate ? format(new Date(item.discountStartDate), "PPP") : null}
                />
                <InfoItem
                    label="Discount End Date"
                    value={item.discountEndDate ? format(new Date(item.discountEndDate), "PPP") : null}
                />
            </InfoSection>

            <InfoSection title="Attributes">
                <InfoItem label="Size" value={item.size?.name} />
                <InfoItem label="Color" value={item.color?.name} />
                <InfoItem label="Silhouette" value={item.silhouette?.name} />
                <InfoItem label="Case" value={item.case} />
                <InfoItem label="Band" value={item.band} />
                <InfoItem label="Movement Type" value={item.movementType} />
                <InfoItem label="Heel Height" value={item.heelHeight} />
                <InfoItem label="Width" value={item.width} />
            </InfoSection>
        </div>
    );
}
