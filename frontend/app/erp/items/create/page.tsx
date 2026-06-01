"use client";

import { useState, useEffect, useRef, startTransition, addTransitionType } from "react";
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
import { CalendarIcon, Upload, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { getBrands } from "@/lib/actions/brand";
import { getDivisions } from "@/lib/actions/division";
import { getCategories } from "@/lib/actions/category";
import { getGenders } from "@/lib/actions/gender";
import { getColors } from "@/lib/actions/color";
import { getSilhouettes } from "@/lib/actions/silhouette";
import { getChannelClasses } from "@/lib/actions/channel-class";
import { getItemClasses } from "@/lib/actions/item-class";
import { getItemSubclasses } from "@/lib/actions/item-subclass";
import { getSeasons } from "@/lib/actions/season";
import { getSizes } from "@/lib/actions/size";
import { getSegments } from "@/lib/actions/segment";
import { createItem, getNextItemId } from "@/lib/actions/items";
import { getTaxRates } from "@/lib/actions/tax-rate";
import { getHsCodes } from "@/lib/actions/hs-code";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { uploadFile } from "@/lib/upload";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { QRCodeSVG } from "qrcode.react";
import {
    generateBarcode, BARCODE_PATTERNS, type BarcodePattern,
} from "@/lib/barcode";
import JsBarcode from "jsbarcode";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
    DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Wand2, RefreshCw, Printer, CheckCircle2, ChevronDown, ScanBarcode } from "lucide-react";

// --- Validation Schemas ---

const itemFormSchema = z.object({
    // Step 1: Basic Info
    brandId: z.string().min(1, "Brand is required"),
    description: z.string().optional(),
    sku: z.string().optional(),
    // itemId removed (auto-generated)
    barCode: z.string().optional(),
    hsCodeId: z.string().optional(),
    isActive: z.boolean(),
    imageUrl: z.string().optional(),

    // Step 2: Classification (Masters)
    divisionId: z.string().optional(),
    categoryId: z.string().optional(),
    subCategoryId: z.string().optional(),
    itemClassId: z.string().optional(),
    itemSubclassId: z.string().optional(),
    channelClassId: z.string().optional(),
    genderId: z.string().optional(),
    seasonId: z.string().optional(),
    // uomId removed
    segmentId: z.string().optional(),

    // Step 3: Pricing & Discount
    unitPrice: z.coerce.number().min(0),
    fob: z.coerce.number().min(0).optional(),
    unitCost: z.coerce.number().min(0).optional(),
    taxRate1: z.coerce.number().min(0).optional(),
    taxRate2: z.coerce.number().min(0).optional(),
    discountRate: z.coerce.number().min(0).optional(),
    discountAmount: z.coerce.number().min(0).optional(),
    discountStartDate: z.date().optional(),
    discountEndDate: z.date().optional(),

    // Step 4: Attributes
    sizeId: z.string().optional(),
    colorId: z.string().optional(),
    silhouetteId: z.string().optional(),
    case: z.string().optional(),
    band: z.string().optional(),
    movementType: z.string().optional(),
    heelHeight: z.string().optional(),
    width: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

const STEPS = ["Basic & Pricing", "Classification", "Attributes", "Review & Generate"];

// ─── Inline barcode preview (used in form + success screen) ──────────────────

function SvgBarcodePreview({ value, height = 32 }: { value: string; height?: number }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: 1.2,
                    height: height,
                    displayValue: false,
                    margin: 8,
                    background: "#ffffff",
                    lineColor: "#000000",
                });
            } catch (e) {
                console.error("Barcode preview rendering error:", e);
            }
        }
    }, [value, height]);

    return (
        <svg
            ref={svgRef}
            style={{ display: "block", maxWidth: "100%", height: "auto" }}
        />
    );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function CreatedItemSuccess({
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
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Item Created!</h2>
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
                <Button onClick={onGoToList} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to List
                </Button>
            </div>
        </div>
    );
}

export default function ItemCreatePage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [masters, setMasters] = useState<{
        brands: any[];
        divisions: any[];
        categories: any[];
        genders: any[];
        colors: any[];
        silhouettes: any[];
        channelClasses: any[];
        itemClasses: any[];
        itemSubclasses: any[];
        seasons: any[];
        // uoms removed
        sizes: any[];
        segments: any[];
        taxRates: { id: string; taxRate1: number }[];
        hsCodes: any[];
    }>({
        brands: [],
        divisions: [],
        categories: [],
        genders: [],
        colors: [],
        silhouettes: [],
        channelClasses: [],
        itemClasses: [],
        itemSubclasses: [],
        seasons: [],
        // uoms removed
        sizes: [],
        segments: [],
        taxRates: [],
        hsCodes: [],
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

    const form = useForm({
        resolver: zodResolver(itemFormSchema),
        defaultValues: {
            brandId: "",
            description: "",
            sku: "",
            barCode: "",
            hsCodeId: "",
            isActive: true,
            unitPrice: 0,
            fob: 0,
            unitCost: 0,
            taxRate1: 0,
            taxRate2: 0,
            discountRate: 0,
            discountAmount: 0,
        },
        mode: "onChange",
    });

    const watchBrandId = form.watch("brandId");
    const watchCategoryId = form.watch("categoryId");
    const watchSubCategoryId = form.watch("subCategoryId");
    const watchGenderId = form.watch("genderId");
    const watchSeasonId = form.watch("seasonId");
    const watchSizeId = form.watch("sizeId");
    const watchColorId = form.watch("colorId");
    const watchSilhouetteId = form.watch("silhouetteId");
    const watchItemClassId = form.watch("itemClassId");

    // Image Upload State
    const [cropDialogOpen, setCropDialogOpen] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const onCropComplete = (_: any, areaPixels: any) => setCroppedAreaPixels(areaPixels);

    async function getCroppedBlob(imageSrc: string, area: any): Promise<Blob> {
        const image: HTMLImageElement = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageSrc;
        });
        const canvas = document.createElement('canvas');
        canvas.width = area.width;
        canvas.height = area.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(
            image,
            area.x,
            area.y,
            area.width,
            area.height,
            0,
            0,
            area.width,
            area.height
        );
        return await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
    }

    const handleCropDialogClose = (open: boolean) => {
        if (!open) {
            setCropSrc(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
        }
        setCropDialogOpen(open);
    };

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const src = URL.createObjectURL(file);
        setCropSrc(src);
        setCropDialogOpen(true);
    };

    const confirmCropAndUpload = async () => {
        if (!cropSrc || !croppedAreaPixels) return;
        try {
            const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
            const file = new File([blob], 'item-image.jpg', { type: 'image/jpeg' });

            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);

            const uploaded = await uploadFile(file);
            form.setValue("imageUrl", uploaded.url);
            toast.success("Image uploaded successfully");

            handleCropDialogClose(false);
        } catch (err: any) {
            toast.error(err?.message || "Failed to upload image");
            handleCropDialogClose(false);
        }
    };

    useEffect(() => {
        const fetchMasters = async () => {
            setLoading(true);
            try {
                const [
                    brands, divisions, categories, genders, colors,
                    silhouettes, channelClasses, itemClasses, itemSubclasses,
                    seasons, sizes, segments, nextIdResp, taxRates, hsCodes
                ] = await Promise.all([
                    getBrands(), getDivisions(), getCategories(), getGenders(), getColors(),
                    getSilhouettes(), getChannelClasses(), getItemClasses(), getItemSubclasses(),
                    getSeasons(), getSizes(), getSegments(), getNextItemId(), getTaxRates(),
                    getHsCodes()
                ]);

                setMasters({
                    brands: brands.data || [],
                    divisions: divisions.data || [],
                    categories: categories.data || [],
                    genders: genders.data || [],
                    colors: colors.data || [],
                    silhouettes: silhouettes.data || [],
                    channelClasses: channelClasses.data || [],
                    itemClasses: itemClasses.data || [],
                    itemSubclasses: itemSubclasses.data || [],
                    seasons: seasons.data || [],
                    // uoms removed
                    sizes: sizes.data || [],
                    segments: segments.data || [],
                    taxRates: taxRates.data || [],
                    hsCodes: hsCodes.data || [],
                });

                // Pre-select Brand "Ivar"
                const brandList = brands.data || [];
                const ivarBrand = brandList.find((b: any) => b.name.toLowerCase() === "ivar" || b.name.toUpperCase() === "IVAR");
                if (ivarBrand) {
                    form.setValue("brandId", ivarBrand.id);
                } else if (brandList.length > 0) {
                    form.setValue("brandId", brandList[0].id);
                }

                // Pre-select first Segment
                const segmentList = segments.data || [];
                if (segmentList.length > 0) {
                    form.setValue("segmentId", segmentList[0].id);
                }

                // Pre-select default HS Code
                const hsCodeList = hsCodes.data || [];
                if (hsCodeList.length > 0) {
                    const defaultHs = hsCodeList.find((h: any) => h.hsCode === "610910") || hsCodeList[0];
                    form.setValue("hsCodeId", defaultHs.id);
                }

                // Set default premium placeholder image URL and status active
                form.setValue("imageUrl", "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80");
                form.setValue("isActive", true);

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

    // Reactive effect to dynamically compute SKU, Barcode, and Description
    useEffect(() => {
        const genderRec = masters.genders.find((g: any) => g.id === watchGenderId);
        const subCategoryRec = masters.categories.find((c: any) => c.id === watchSubCategoryId);
        const silhouetteRec = masters.silhouettes.find((s: any) => s.id === watchSilhouetteId);
        const colorRec = masters.colors.find((c: any) => c.id === watchColorId);
        const sizeRec = masters.sizes.find((s: any) => s.id === watchSizeId);
        const categoryRec = masters.categories.find((c: any) => c.id === watchCategoryId);
        const seasonRec = masters.seasons.find((s: any) => s.id === watchSeasonId);

        const brandCode = "IVAR";
        const genderCode = genderRec ? genderRec.name.charAt(0).toUpperCase() : "X";
        const subCatCode = subCategoryRec ? subCategoryRec.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() : "XX";
        const silCode = silhouetteRec ? silhouetteRec.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() : "XX";
        const colCode = colorRec ? colorRec.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() : "XXX";
        const sizeCode = sizeRec ? sizeRec.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "XX";
        const serial = nextItemId ? nextItemId.slice(-3) : "001";

        const computedSku = `${brandCode}-${genderCode}-${subCatCode}-${silCode}-${colCode}-${sizeCode}-${serial}`;
        const computedDescription = `Ivar ${categoryRec?.name || ""} ${subCategoryRec?.name || ""} in ${colorRec?.name || ""} for ${genderRec?.name || ""} (${seasonRec?.name || ""} - ${silhouetteRec?.name || ""}, Size ${sizeRec?.name || ""})`;

        form.setValue("sku", computedSku);
        form.setValue("barCode", computedSku);
        form.setValue("description", computedDescription);
    }, [
        watchGenderId,
        watchSubCategoryId,
        watchSilhouetteId,
        watchColorId,
        watchSizeId,
        watchCategoryId,
        watchSeasonId,
        masters,
        nextItemId
    ]);

    // Filtered masters for dependent dropdowns
    const filteredDivisions = masters.divisions.filter((d: any) => d.brandId === watchBrandId);
    const filteredSubCategories = masters.categories.filter((c: any) => c.parentId === watchCategoryId);
    const filteredItemSubclasses = masters.itemSubclasses.filter((s: any) => s.itemClassId === watchItemClassId);

    const nextStep = async () => {
        const fieldsToValidate = getFieldsForStep(currentStep);
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
        }
    };

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const onSubmit = async (data: ItemFormValues) => {
        try {
            const result = await createItem(data);
            if (result.status) {
                toast.success("Item created successfully");
                setCreatedItem({
                    barCode: data.barCode || "",
                    sku: data.sku,
                    description: data.description || "",
                    unitPrice: data.unitPrice,
                    itemId: result.data?.itemId || nextItemId,
                });
            } else {
                toast.error(result.message || "Failed to create item");
            }
        } catch (error) {
            console.error("Error creating item:", error);
            toast.error("An unexpected error occurred");
        }
    };

    const getFieldsForStep = (step: number): (keyof ItemFormValues)[] => {
        switch (step) {
            case 0:
                return ["brandId", "segmentId", "unitPrice", "fob", "unitCost", "taxRate1", "taxRate2", "discountRate", "discountAmount", "discountStartDate", "discountEndDate"];
            case 1:
                return ["categoryId", "subCategoryId", "channelClassId", "genderId", "seasonId"];
            case 2:
                return ["sizeId", "colorId", "silhouetteId"];
            case 3:
                return [];
            default:
                return [];
        }
    };

    return (
        <PermissionGuard permissions="erp.item.create">
        <div className="container mx-auto py-10 max-w-5xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create New Item</h1>
                    <p className="text-muted-foreground">Add a new item to your inventory catalog.</p>
                </div>
                <Link href="/erp/items/list" transitionTypes={["nav-back"]}>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                    </Button>
                </Link>
            </div>

            <Steps steps={STEPS} currentStep={currentStep} />

            <div className="mt-8">
                {loading ? (
                    <div className="flex items-center justify-center p-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : createdItem ? (
                    <Card>
                        <CardContent className="pt-6">
                            <CreatedItemSuccess
                                item={createdItem}
                                onCreateAnother={() => {
                                    setCreatedItem(null);
                                    form.reset();
                                    setCurrentStep(0);
                                    setImagePreview(null);
                                    // Refresh next item ID
                                    getNextItemId().then((r) => {
                                        if (r?.status && r?.data?.nextId) setNextItemId(r.data.nextId);
                                    });
                                }}
                                onGoToList={() => {
                                    startTransition(() => {
                                        addTransitionType("nav-back");
                                        router.push("/erp/items/list");
                                    });
                                }}
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>

                            <Card>
                                <CardHeader>
                                    <CardTitle>{STEPS[currentStep]}</CardTitle>
                                    <CardDescription>Enter the details for {STEPS[currentStep].toLowerCase()}.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">

                                    {/* STEP 1: BASIC & PRICING */}
                                    {currentStep === 0 && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="brandId"
                                                    render={({ field }) => (
                                                        <MasterSelect
                                                            label="Concept (Brand) - Locked"
                                                            field={field}
                                                            options={masters.brands}
                                                            disabled={true}
                                                        />
                                                    )}
                                                />
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
                                                <FormItem>
                                                    <FormLabel>Item ID (Auto-Generated)</FormLabel>
                                                    <FormControl>
                                                        <Input value={nextItemId || ""} disabled className="font-mono bg-muted" />
                                                    </FormControl>
                                                </FormItem>
                                            </div>

                                            <div className="border-t my-4 py-4">
                                                <h3 className="font-semibold text-lg mb-4 text-primary">Pricing Details</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    <FormField
                                                        control={form.control}
                                                        name="unitPrice"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>Unit Price <span className="text-red-500">*</span></FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} value={field.value ?? ""} className="font-semibold text-teal-700" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="fob"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>FOB</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="unitCost"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>Unit Cost</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="taxRate1"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>Tax Rate 1 (%)</FormLabel>
                                                                <Select
                                                                    value={field.value !== undefined && field.value !== null ? String(field.value) : ""}
                                                                    onValueChange={(val) => field.onChange(Number(val))}
                                                                >
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select Tax Rate 1" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {masters.taxRates.map((tr) => (
                                                                            <SelectItem key={tr.id} value={String(tr.taxRate1)}>
                                                                                {tr.taxRate1}%
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="taxRate2"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>Tax Rate 2 (%)</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            <div className="border-t my-4 py-4">
                                                <h3 className="font-semibold text-base mb-4 text-muted-foreground">Discount Information (Optional)</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    <FormField
                                                        control={form.control}
                                                        name="discountRate"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>Discount Rate (%)</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="discountAmount"
                                                        render={({ field }: { field: any }) => (
                                                            <FormItem>
                                                                <FormLabel>Discount Amount</FormLabel>
                                                                <FormControl>
                                                                    <Input type="number" {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 2: CLASSIFICATION */}
                                    {currentStep === 1 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="categoryId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Category"
                                                        field={field}
                                                        options={masters.categories.filter((c: any) => !c.parentId)}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="subCategoryId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Sub Category"
                                                        field={field}
                                                        options={filteredSubCategories}
                                                        disabled={!watchCategoryId}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="channelClassId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Channel Class"
                                                        field={field}
                                                        options={masters.channelClasses}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="genderId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Gender"
                                                        field={field}
                                                        options={masters.genders}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="seasonId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Season"
                                                        field={field}
                                                        options={masters.seasons}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="hsCodeId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="HS Code"
                                                        field={field}
                                                        options={masters.hsCodes.map(h => ({ id: h.id, name: h.hsCode }))}
                                                    />
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* STEP 3: ATTRIBUTES */}
                                    {currentStep === 2 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="sizeId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Size"
                                                        field={field}
                                                        options={masters.sizes}
                                                    />
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
                                                name="silhouetteId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Silhouette"
                                                        field={field}
                                                        options={masters.silhouettes}
                                                    />
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* STEP 4: REVIEW & GENERATE */}
                                    {currentStep === 3 && (
                                        <div className="space-y-8">
                                            <div className="bg-slate-50 border rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-8">
                                                <div className="flex-shrink-0">
                                                    <img
                                                        src={form.getValues("imageUrl") || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80"}
                                                        alt="Item preview"
                                                        className="w-32 h-32 rounded-lg object-cover border bg-white"
                                                    />
                                                </div>
                                                <div className="flex-grow space-y-2 text-center md:text-left">
                                                    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                        Active Status (Locked)
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                                                        {form.getValues("description") || "No Description Generated"}
                                                    </h3>
                                                    <div className="text-sm font-mono text-slate-500">
                                                        SKU: <span className="font-semibold text-slate-800">{form.getValues("sku") || "N/A"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Barcode section */}
                                            {form.getValues("sku") && (
                                                <div className="bg-white border rounded-xl p-6 flex flex-col items-center gap-3">
                                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dynamic Barcode</span>
                                                    <SvgBarcodePreview value={form.getValues("sku") || "IVAR"} height={48} />
                                                    <span className="text-sm font-mono font-bold tracking-widest text-slate-800">
                                                        {form.getValues("sku")}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="border rounded-xl p-6 bg-white space-y-4">
                                                    <h4 className="font-bold text-slate-900 border-b pb-2">Classification Info</h4>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Concept (Brand)</span>
                                                            <span className="font-medium text-slate-800">Ivar</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Category</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.categories.find((c: any) => c.id === form.getValues("categoryId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Sub Category</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.categories.find((c: any) => c.id === form.getValues("subCategoryId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Gender</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.genders.find((g: any) => g.id === form.getValues("genderId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Season</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.seasons.find((s: any) => s.id === form.getValues("seasonId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">HS Code</span>
                                                            <span className="font-medium text-slate-800 font-mono">
                                                                {(masters.hsCodes.find((h: any) => h.id === form.getValues("hsCodeId")) as any)?.hsCode || "N/A"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border rounded-xl p-6 bg-white space-y-4">
                                                    <h4 className="font-bold text-slate-900 border-b pb-2">Attributes & Pricing</h4>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Size</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.sizes.find((s: any) => s.id === form.getValues("sizeId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Color</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.colors.find((c: any) => c.id === form.getValues("colorId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Silhouette</span>
                                                            <span className="font-medium text-slate-800">
                                                                {(masters.silhouettes.find((s: any) => s.id === form.getValues("silhouetteId")) as any)?.name || "N/A"}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Unit Price</span>
                                                            <span className="font-bold text-emerald-700">
                                                                {Number(form.getValues("unitPrice") || 0).toLocaleString("en-US", { style: "currency", currency: "PKR", minimumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">Unit Cost</span>
                                                            <span className="font-medium text-slate-800">
                                                                {Number(form.getValues("unitCost") || 0).toLocaleString("en-US", { style: "currency", currency: "PKR", minimumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block text-xs">FOB</span>
                                                            <span className="font-medium text-slate-800">
                                                                {Number(form.getValues("fob") || 0).toLocaleString("en-US", { style: "currency", currency: "PKR", minimumFractionDigits: 0 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                                                Please review all details. Item ID, SKU, Barcode, HS Code, and Description are dynamically auto-generated based on the classification and attributes you selected in the previous steps.
                                            </div>
                                        </div>
                                    )}

                                </CardContent>
                                <CardFooter className="flex justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={prevStep}
                                        disabled={currentStep === 0}
                                    >
                                        Previous
                                    </Button>

                                    {currentStep < STEPS.length - 1 ? (
                                        <Button type="button" onClick={nextStep}>
                                            Next Step
                                        </Button>
                                    ) : (
                                        <Button type="submit">
                                            Create Item
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        </form>
                    </Form>
                )}
            </div>
            {/* <pre className="mt-10 p-4 bg-gray-100 rounded text-xs">{JSON.stringify(form.watch(), null, 2)}</pre> */}
        </div>
        </PermissionGuard>
    );
}
