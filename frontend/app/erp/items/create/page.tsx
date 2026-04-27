"use client";

import { useState, useEffect, startTransition, addTransitionType } from "react";
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

// --- Validation Schemas ---

const itemFormSchema = z.object({
    // Step 1: Basic Info
    brandId: z.string().min(1, "Brand is required"),
    description: z.string().optional(),
    sku: z.string().min(1, "SKU is required"),
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

const STEPS = ["Basic Details", "Classification", "Pricing & Discounts", "Attributes", "Review"];

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
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/erp/items/list");
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
                return ["brandId", "segmentId", "sku", "barCode", "hsCodeId", "isActive", "description"];
            case 1:
                return ["divisionId", "categoryId", "subCategoryId", "itemClassId", "itemSubclassId", "channelClassId", "genderId", "seasonId"];
            case 2:
                return ["unitPrice", "fob", "unitCost", "taxRate1", "taxRate2", "discountRate", "discountAmount", "discountStartDate", "discountEndDate"];
            case 3:
                return ["sizeId", "colorId", "silhouetteId", "case", "band", "movementType", "heelHeight", "width"];
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
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>

                            <Card>
                                <CardHeader>
                                    <CardTitle>{STEPS[currentStep]}</CardTitle>
                                    <CardDescription>Enter the details for {STEPS[currentStep].toLowerCase()}.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">

                                    {/* STEP 1: BASIC DETAILS */}
                                    {currentStep === 0 && (
                                        <>
                                            {/* Image Upload Section */}
                                            <div className="flex flex-col items-center gap-6 mb-6">
                                                <div
                                                    className="relative cursor-pointer group"
                                                    onClick={() => document.getElementById("item-image-input")?.click()}
                                                >
                                                    {imagePreview ? (
                                                        <img
                                                            src={imagePreview}
                                                            alt="Item preview"
                                                            className="w-40 h-40 rounded-md object-cover border-4 border-border group-hover:opacity-80 transition-opacity"
                                                        />
                                                    ) : (
                                                        <div className="w-40 h-40 rounded-md bg-muted flex items-center justify-center border-4 border-border group-hover:bg-muted/80 transition-colors">
                                                            <div className="flex flex-col items-center text-muted-foreground">
                                                                <Upload className="h-10 w-10 mb-2" />
                                                                <span className="text-xs">Upload Image</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    id="item-image-input"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                            </div>

                                            <Dialog open={cropDialogOpen} onOpenChange={handleCropDialogClose}>
                                                <DialogContent className="sm:max-w-[480px]">
                                                    <DialogHeader>
                                                        <DialogTitle>Crop Item Image</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="relative w-full h-80 bg-muted rounded-md overflow-hidden">
                                                        {cropSrc && (
                                                            <Cropper
                                                                image={cropSrc}
                                                                crop={crop}
                                                                zoom={zoom}
                                                                aspect={1}
                                                                onCropChange={setCrop}
                                                                onZoomChange={setZoom}
                                                                onCropComplete={onCropComplete}
                                                            />
                                                        )}
                                                    </div>
                                                    <DialogFooter>
                                                        <div className="flex w-full justify-end gap-2">
                                                            <Button variant="outline" onClick={() => handleCropDialogClose(false)}>Cancel</Button>
                                                            <Button onClick={confirmCropAndUpload}>Save</Button>
                                                        </div>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

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
                                                            label="Concept (Brand)"
                                                            field={field}
                                                            options={masters.brands}
                                                        />
                                                    )}
                                                />
                                                <FormItem>
                                                    <FormLabel>Item ID (Auto)</FormLabel>
                                                    <FormControl>
                                                        <Input value={nextItemId || ""} disabled />
                                                    </FormControl>
                                                </FormItem>
                                                <FormField
                                                    control={form.control}
                                                    name="sku"
                                                    render={({ field }: { field: any }) => (
                                                        <FormItem>
                                                            <FormLabel>SKU <span className="text-red-500">*</span></FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="SKU Number" {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="barCode"
                                                    render={({ field }: { field: any }) => (
                                                        <FormItem>
                                                            <FormLabel>Barcode</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="EAN / UPC" {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
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
                                                <FormField
                                                    control={form.control}
                                                    name="description"
                                                    render={({ field }: { field: any }) => (
                                                        <FormItem className="col-span-full">
                                                            <FormLabel>Description</FormLabel>
                                                            <FormControl>
                                                                <Textarea placeholder="Detailed product description..." {...field} value={field.value ?? ""} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="isActive"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 col-span-full">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1 leading-none">
                                                                <FormLabel>
                                                                    Active Item
                                                                </FormLabel>
                                                                <FormDescription>
                                                                    This item will be visible in sales and inventory channels.
                                                                </FormDescription>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* STEP 2: CLASSIFICATION */}
                                    {currentStep === 1 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="divisionId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Division"
                                                        field={field}
                                                        options={filteredDivisions}
                                                        disabled={!watchBrandId}
                                                    />
                                                )}
                                            />
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
                                                name="itemClassId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Item Class"
                                                        field={field}
                                                        options={masters.itemClasses}
                                                    />
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="itemSubclassId"
                                                render={({ field }) => (
                                                    <MasterSelect
                                                        label="Item Subclass"
                                                        field={field}
                                                        options={filteredItemSubclasses}
                                                        disabled={!watchItemClassId}
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
                                            {/* UOM removed */}

                                        </div>
                                    )}

                                    {/* STEP 3: PRICING & DISCOUNTS */}
                                    {currentStep === 2 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="unitPrice"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Unit Price</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" {...field} value={field.value ?? ""} />
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

                                            <div className="col-span-full border-t my-4 py-4">
                                                <h3 className="font-semibold mb-4">Discount Information</h3>
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
                                                    <FormField
                                                        control={form.control}
                                                        name="discountStartDate"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel>Discount Start Date</FormLabel>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <FormControl>
                                                                            <Button
                                                                                variant={"outline"}
                                                                                className={cn(
                                                                                    "pl-3 text-left font-normal",
                                                                                    !field.value && "text-muted-foreground"
                                                                                )}
                                                                            >
                                                                                {field.value ? (
                                                                                    format(field.value, "PPP")
                                                                                ) : (
                                                                                    <span>Pick a date</span>
                                                                                )}
                                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0" align="start">
                                                                        <Calendar
                                                                            mode="single"
                                                                            selected={field.value}
                                                                            onSelect={field.onChange}
                                                                            disabled={(date) =>
                                                                                date < new Date("1900-01-01")
                                                                            }
                                                                            initialFocus
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="discountEndDate"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel>Discount End Date</FormLabel>
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <FormControl>
                                                                            <Button
                                                                                variant={"outline"}
                                                                                className={cn(
                                                                                    "pl-3 text-left font-normal",
                                                                                    !field.value && "text-muted-foreground"
                                                                                )}
                                                                            >
                                                                                {field.value ? (
                                                                                    format(field.value, "PPP")
                                                                                ) : (
                                                                                    <span>Pick a date</span>
                                                                                )}
                                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                            </Button>
                                                                        </FormControl>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0" align="start">
                                                                        <Calendar
                                                                            mode="single"
                                                                            selected={field.value}
                                                                            onSelect={field.onChange}
                                                                            disabled={(date) =>
                                                                                date < new Date("1900-01-01")
                                                                            }
                                                                            initialFocus
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* STEP 4: ATTRIBUTES */}
                                    {currentStep === 3 && (
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
                                            <FormField
                                                control={form.control}
                                                name="case"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Case</FormLabel>
                                                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="band"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Band</FormLabel>
                                                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="movementType"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Movement Type</FormLabel>
                                                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="heelHeight"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Heel Height</FormLabel>
                                                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="width"
                                                render={({ field }: { field: any }) => (
                                                    <FormItem>
                                                        <FormLabel>Width</FormLabel>
                                                        <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {/* STEP 5: REVIEW */}
                                    {currentStep === 4 && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">Image</Label>
                                                    <div className="font-medium">
                                                        {imagePreview ? (
                                                            <img src={imagePreview} alt="Item" className="w-16 h-16 object-cover rounded mt-1" />
                                                        ) : "N/A"}
                                                    </div>
                                                </div>
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">Item ID</Label>
                                                    <div className="font-medium">{nextItemId}</div>
                                                </div>
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">SKU</Label>
                                                    <div className="font-medium">{form.getValues("sku")}</div>
                                                </div>
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">Brand (Concept)</Label>
                                                    <div className="font-medium">
                                                        {(masters.brands.find((b: any) => b.id === form.getValues("brandId")) as any)?.name}
                                                    </div>
                                                </div>
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">Division</Label>
                                                    <div className="font-medium">
                                                        {(masters.divisions.find((d: any) => d.id === form.getValues("divisionId")) as any)?.name || "N/A"}
                                                    </div>
                                                </div>
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">Category</Label>
                                                    <div className="font-medium">
                                                        {(masters.categories.find((c: any) => c.id === form.getValues("categoryId")) as any)?.name || "N/A"}
                                                    </div>
                                                </div>
                                                <div className="border p-3 rounded-md bg-white">
                                                    <Label className="text-muted-foreground text-xs">Price</Label>
                                                    <div className="font-medium">{String(form.getValues("unitPrice") || 0)}</div>
                                                </div>
                                            </div>
                                            <div className="bg-muted p-4 rounded-md">
                                                <p className="text-sm font-medium">Please review the information above before submitting. Creation is final for this step.</p>
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

            {/* Dev helper to visualize state */}
            {/* <pre className="mt-10 p-4 bg-gray-100 rounded text-xs">{JSON.stringify(form.watch(), null, 2)}</pre> */}
        </div>
        </PermissionGuard>
    );
}
