"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Steps } from "@/components/ui/steps-indicator";
import { MasterSelect } from "@/components/form/master-select";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CalendarIcon, ArrowLeft, Sparkles, Wand2, RefreshCw, Printer, CheckCircle2, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrands } from "@/lib/actions/brand";
import { getColors } from "@/lib/actions/color";
import { getSegments } from "@/lib/actions/segment";
import { createItem, getNextItemId } from "@/lib/actions/items";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { QRCodeSVG } from "qrcode.react";
import {
    generateBarcode, BARCODE_PATTERNS, type BarcodePattern,
} from "@/lib/barcode";
import JsBarcode from "jsbarcode";

// --- Validation Schema ---
const fabricFormSchema = z.object({
    itemType: z.literal("RAW_FABRIC"),
    uom: z.string().min(1, "UOM is required"),
    rollSize: z.coerce.number().min(0).optional(),
    brandId: z.string().min(1, "Brand is required"),
    segmentId: z.string().optional(),
    sku: z.string().min(1, "Fabric Code / SKU is required"),
    barCode: z.string().optional(),
    isActive: z.boolean(),
    description: z.string().optional(),
    colorId: z.string().optional(),
    unitCost: z.coerce.number().min(0).optional(),
    unitPrice: z.coerce.number().min(0),
});

type FabricFormValues = z.infer<typeof fabricFormSchema>;

const STEPS = ["Fabric Details", "Review"];

// --- Inline barcode preview ---
function SvgBarcodePreview({ value, height = 36 }: { value: string; height?: number }) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: 1.2,
                    height,
                    displayValue: false,
                    margin: 4,
                    background: "#ffffff",
                    lineColor: "#000000",
                });
            } catch (e) {
                console.error("Barcode preview error:", e);
            }
        }
    }, [value, height]);
    return <svg ref={svgRef} style={{ display: "block", maxWidth: "100%", height: "auto" }} />;
}

// --- Success screen ---
function CreatedFabricSuccess({
    item,
    onCreateAnother,
    onGoToList,
}: {
    item: { barCode: string; sku: string; description: string; unitPrice: number; itemId: string };
    onCreateAnother: () => void;
    onGoToList: () => void;
}) {
    const price = Number(item.unitPrice).toLocaleString("en-US", {
        style: "currency", currency: "PKR", minimumFractionDigits: 0,
    });

    const handlePrint = () => {
        const styleId = "barcode-success-print-styles";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                @media print {
                    body > *:not(#barcode-success-root) { display: none !important; }
                    #barcode-success-root {
                        display: flex !important;
                        align-items: center;
                        justify-content: center;
                        position: fixed;
                        inset: 0;
                        background: white;
                        z-index: 99999;
                    }
                    @page { margin: 8mm; }
                }
            `;
            document.head.appendChild(style);
        }
        let root = document.getElementById("barcode-success-root");
        if (!root) {
            root = document.createElement("div");
            root.id = "barcode-success-root";
            document.body.appendChild(root);
        }
        const printEl = document.getElementById("barcode-success-label");
        if (printEl) root.innerHTML = printEl.innerHTML;
        window.print();
        setTimeout(() => { if (root) root.innerHTML = ""; }, 1000);
    };

    return (
        <div className="flex flex-col items-center gap-8 py-10 px-4 text-center">
            {/* Success icon */}
            <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle2 className="h-9 w-9 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Fabric Item Created!</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        {item.description || item.sku} has been added to the catalog.
                    </p>
                </div>
            </div>

            {/* Barcode label card */}
            <div
                id="barcode-success-label"
                className="bg-white border-2 border-border rounded-xl shadow-md px-8 py-6 flex flex-col items-center gap-3 min-w-64"
            >
                {item.description && (
                    <div className="text-base font-bold tracking-tight text-center leading-tight max-w-xs">
                        {item.description}
                    </div>
                )}
                <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>

                {item.barCode ? (
                    <>
                        <div className="my-1">
                            <SvgBarcodePreview value={item.barCode} height={56} />
                        </div>
                        <div className="text-sm font-mono font-semibold tracking-widest text-foreground">
                            {item.barCode}
                        </div>
                        <div className="mt-1">
                            <QRCodeSVG value={item.barCode} size={72} level="M" />
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-muted-foreground italic py-4">No barcode assigned</div>
                )}

                <div className="text-xl font-bold mt-1">{price}</div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-center">
                {item.barCode && (
                    <Button variant="outline" onClick={handlePrint} className="gap-2">
                        <Printer className="h-4 w-4" /> Print Label
                    </Button>
                )}
                <Button variant="outline" onClick={onCreateAnother} className="gap-2">
                    <ScanBarcode className="h-4 w-4" /> Create Another
                </Button>
                <Button onClick={onGoToList} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <ArrowLeft className="h-4 w-4" /> Back to List
                </Button>
            </div>
        </div>
    );
}

export default function CreateProductionFabricPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [masters, setMasters] = useState<{
        brands: any[];
        colors: any[];
        segments: any[];
    }>({
        brands: [],
        colors: [],
        segments: [],
    });

    const [loading, setLoading] = useState(true);
    const [nextItemId, setNextItemId] = useState<string>("");
    const [createdItem, setCreatedItem] = useState<{
        barCode: string;
        sku: string;
        description: string;
        unitPrice: number;
        itemId: string;
    } | null>(null);

    const form = useForm<FabricFormValues>({
        resolver: zodResolver(fabricFormSchema),
        defaultValues: {
            itemType: "RAW_FABRIC",
            uom: "Meter",
            rollSize: undefined,
            brandId: "",
            segmentId: "",
            description: "",
            sku: "",
            barCode: "",
            isActive: true,
            unitCost: 0,
            unitPrice: 0,
            colorId: "",
        },
        mode: "onChange",
    });

    useEffect(() => {
        const fetchMasters = async () => {
            setLoading(true);
            try {
                const [brands, colors, segments, nextIdResp] = await Promise.all([
                    getBrands(),
                    getColors(),
                    getSegments(),
                    getNextItemId(),
                ]);

                setMasters({
                    brands: brands.data || [],
                    colors: colors.data || [],
                    segments: segments.data || [],
                });

                if (nextIdResp?.status && nextIdResp?.data?.nextId) {
                    setNextItemId(nextIdResp.data.nextId);
                }
            } catch (error) {
                console.error("Failed to fetch masters:", error);
                toast.error("Failed to load master data");
            } finally {
                setLoading(false);
            }
        };

        fetchMasters();
    }, []);

    const nextStep = async () => {
        const fieldsToValidate: (keyof FabricFormValues)[] = [
            "brandId",
            "sku",
            "uom",
            "rollSize",
            "colorId",
            "unitCost",
            "unitPrice",
            "barCode",
            "description",
            "isActive",
            "segmentId",
        ];
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
        }
    };

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const onSubmit = async (data: FabricFormValues) => {
        try {
            const result = await createItem(data);
            if (result.status) {
                toast.success("Fabric item created successfully");
                setCreatedItem({
                    barCode: data.barCode || "",
                    sku: data.sku,
                    description: data.description || "",
                    unitPrice: data.unitPrice || 0,
                    itemId: result.data?.itemId || nextItemId,
                });
            } else {
                toast.error(result.message || "Failed to create fabric item");
            }
        } catch (error) {
            console.error("Error creating fabric item:", error);
            toast.error("An unexpected error occurred");
        }
    };

    return (
        <PermissionGuard permissions="erp.item.create">
            <div className="container mx-auto py-10 max-w-5xl">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-blue-900 flex items-center gap-2">
                            <Sparkles className="h-8 w-8 text-blue-500 animate-pulse" />
                            Create Production Fabric
                        </h1>
                        <p className="text-muted-foreground">Add a new production fabric to your inventory catalog.</p>
                    </div>
                    <Link href="/erp/items/list" transitionTypes={["nav-back"]}>
                        <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                        </Button>
                    </Link>
                </div>

                <Steps steps={STEPS} currentStep={currentStep} className="text-blue-600" />

                <div className="mt-8">
                    {loading ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : createdItem ? (
                        <Card className="border-blue-100 shadow-xl shadow-blue-50">
                            <CardContent className="pt-6">
                                <CreatedFabricSuccess
                                    item={createdItem}
                                    onCreateAnother={() => {
                                        setCreatedItem(null);
                                        form.reset();
                                        setCurrentStep(0);
                                        getNextItemId().then((r) => {
                                            if (r?.status && r?.data?.nextId) setNextItemId(r.data.nextId);
                                        });
                                    }}
                                    onGoToList={() => {
                                        startTransition(() => {
                                            router.push("/erp/items/list");
                                        });
                                    }}
                                />
                            </CardContent>
                        </Card>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)}>
                                <Card className="border-blue-100 shadow-xl shadow-blue-50">
                                    <CardHeader className="bg-gradient-to-r from-blue-50/50 to-indigo-50/10 border-b border-blue-100/50">
                                        <CardTitle className="text-xl text-blue-900">{STEPS[currentStep]}</CardTitle>
                                        <CardDescription>
                                            Enter the specifications for the new fabric item.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6">

                                        {/* STEP 1: FABRIC DETAILS */}
                                        {currentStep === 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="segmentId"
                                                    render={({ field }) => (
                                                        <MasterSelect
                                                            label="Segment"
                                                            field={field}
                                                            options={masters.segments}
                                                        />
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="brandId"
                                                    render={({ field }) => (
                                                        <MasterSelect
                                                            label="Concept (Brand) *"
                                                            field={field}
                                                            options={masters.brands}
                                                        />
                                                    )}
                                                />
                                                <FormItem>
                                                    <FormLabel>Item ID (Auto)</FormLabel>
                                                    <FormControl>
                                                        <Input value={nextItemId || ""} disabled className="bg-slate-50 font-mono" />
                                                    </FormControl>
                                                </FormItem>
                                                <FormField
                                                    control={form.control}
                                                    name="uom"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Unit of Measure (UOM) *</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || "Meter"}>
                                                                <FormControl>
                                                                    <SelectTrigger className="border-blue-100 focus:ring-blue-500">
                                                                        <SelectValue placeholder="Select UOM" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="Meter">Meter</SelectItem>
                                                                    <SelectItem value="Yard">Yard</SelectItem>
                                                                    <SelectItem value="Kg">Kg</SelectItem>
                                                                    <SelectItem value="Roll">Roll</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="rollSize"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Roll Size / Length</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="e.g. 1000 or 3000"
                                                                    className="border-blue-100 focus:ring-blue-500"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="colorId"
                                                    render={({ field }) => (
                                                        <MasterSelect
                                                            label="Color"
                                                            field={field}
                                                            options={masters.colors}
                                                        />
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="sku"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Fabric Code / SKU *</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="Enter SKU"
                                                                    className="border-blue-100 focus:ring-blue-500 font-mono"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="unitCost"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Cost per Unit (Estimated)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    className="border-blue-100 focus:ring-blue-500"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="unitPrice"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Retail / Issue Price *</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="0.00"
                                                                    className="border-blue-100 focus:ring-blue-500"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="barCode"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Barcode (Optional)</FormLabel>
                                                            <div className="flex gap-2">
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="Barcode"
                                                                        className="border-blue-100 focus:ring-blue-500 font-mono"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                    />
                                                                </FormControl>
                                                                <Select
                                                                    onValueChange={(val) => field.onChange(generateBarcode(val as BarcodePattern, form.getValues("sku")))}
                                                                >
                                                                    <SelectTrigger className="w-12 border-blue-100 px-0 flex justify-center shrink-0">
                                                                        <Wand2 className="h-4 w-4 text-blue-500" />
                                                                    </SelectTrigger>
                                                                    <SelectContent align="end">
                                                                        {BARCODE_PATTERNS.map((p) => (
                                                                            <SelectItem key={p.value} value={p.value}>
                                                                                {p.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            {field.value && (
                                                                <div className="mt-2 flex items-center gap-3 p-2 rounded-md bg-slate-50 border border-blue-50/50">
                                                                    <SvgBarcodePreview value={field.value} />
                                                                    <span className="text-xs font-mono text-muted-foreground break-all">{field.value}</span>
                                                                </div>
                                                            )}
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="description"
                                                    render={({ field }) => (
                                                        <FormItem className="col-span-full">
                                                            <FormLabel>Fabric Details / Description</FormLabel>
                                                            <FormControl>
                                                                <Textarea
                                                                    placeholder="Enter description, weight, composite..."
                                                                    className="resize-none border-blue-100 focus:ring-blue-500"
                                                                    rows={3}
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="isActive"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-blue-100 p-4 col-span-full bg-blue-50/10">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1 leading-none">
                                                                <FormLabel>Active Fabric Item</FormLabel>
                                                                <FormDescription>
                                                                    This fabric will be available for POs, Direct Invoices, and issues.
                                                                </FormDescription>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}

                                        {/* STEP 2: REVIEW */}
                                        {currentStep === 1 && (
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">Item ID</Label>
                                                        <div className="font-semibold text-blue-900 mt-0.5">{nextItemId}</div>
                                                    </div>
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">Fabric Code / SKU</Label>
                                                        <div className="font-mono font-semibold text-blue-900 mt-0.5">{form.getValues("sku")}</div>
                                                    </div>
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">UOM</Label>
                                                        <div className="font-semibold text-blue-900 mt-0.5">{form.getValues("uom") || "Meter"}</div>
                                                    </div>
                                                    {form.getValues("rollSize") !== undefined && (
                                                        <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                            <Label className="text-muted-foreground text-xs font-medium">Roll Size / Length</Label>
                                                            <div className="font-semibold text-blue-900 mt-0.5">{form.getValues("rollSize")}</div>
                                                        </div>
                                                    )}
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">Color</Label>
                                                        <div className="font-semibold text-blue-900 mt-0.5">
                                                            {masters.colors.find((c: any) => c.id === form.getValues("colorId"))?.name || "N/A"}
                                                        </div>
                                                    </div>
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">Brand (Concept)</Label>
                                                        <div className="font-semibold text-blue-900 mt-0.5">
                                                            {masters.brands.find((b: any) => b.id === form.getValues("brandId"))?.name || "N/A"}
                                                        </div>
                                                    </div>
                                                    {form.getValues("segmentId") && (
                                                        <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                            <Label className="text-muted-foreground text-xs font-medium">Segment</Label>
                                                            <div className="font-semibold text-blue-900 mt-0.5">
                                                                {masters.segments.find((s: any) => s.id === form.getValues("segmentId"))?.name || "N/A"}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">Estimated Cost Price</Label>
                                                        <div className="font-semibold text-blue-900 mt-0.5">
                                                            {Number(form.getValues("unitCost") || 0).toLocaleString("en-US", { style: "currency", currency: "PKR" })}
                                                        </div>
                                                    </div>
                                                    <div className="border border-blue-50 p-4 rounded-xl bg-slate-50/50">
                                                        <Label className="text-muted-foreground text-xs font-medium">Retail / Issue Price</Label>
                                                        <div className="font-semibold text-blue-900 mt-0.5">
                                                            {Number(form.getValues("unitPrice") || 0).toLocaleString("en-US", { style: "currency", currency: "PKR" })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl text-blue-800">
                                                    <p className="text-sm font-medium">Please review the specifications above. Clicking create will register this production fabric in the system catalog.</p>
                                                </div>
                                            </div>
                                        )}

                                    </CardContent>
                                    <CardFooter className="flex justify-between border-t border-blue-50 pt-6">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={prevStep}
                                            disabled={currentStep === 0}
                                            className="border-blue-200 text-blue-700 hover:bg-blue-50"
                                        >
                                            Previous
                                        </Button>

                                        {currentStep < STEPS.length - 1 ? (
                                            <Button type="button" onClick={nextStep} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                Next Step
                                            </Button>
                                        ) : (
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                                                Create Fabric Item
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            </form>
                        </Form>
                    )}
                </div>
            </div>
        </PermissionGuard>
    );
}
