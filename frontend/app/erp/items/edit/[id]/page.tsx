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
import { CalendarIcon, Loader2, ArrowLeft } from "lucide-react";
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
import { updateItem, getItemById } from "@/lib/actions/items";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/auth/permission-guard";

// --- Validation Schemas ---

const itemFormSchema = z.object({
    // Step 1: Basic Info
    brandId: z.string().min(1, "Brand is required"),
    description: z.string().nullable().optional(),
    sku: z.string().min(1, "SKU is required"),
    itemId: z.string().min(1, "Item ID is required"),
    barCode: z.string().nullable().optional(),
    hsCode: z.string().nullable().optional(),
    isActive: z.boolean(),
    segmentId: z.string().nullable().optional(),

    // Step 2: Classification (Masters)
    divisionId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    subCategoryId: z.string().nullable().optional(),
    itemClassId: z.string().nullable().optional(),
    itemSubclassId: z.string().nullable().optional(),
    channelClassId: z.string().nullable().optional(),
    genderId: z.string().nullable().optional(),
    seasonId: z.string().nullable().optional(),
    // uomId removed

    // Step 3: Pricing & Discount
    unitPrice: z.coerce.number().min(0),
    taxRate1: z.coerce.number().min(0).nullable().optional(),
    taxRate2: z.coerce.number().min(0).nullable().optional(),
    discountRate: z.coerce.number().min(0).nullable().optional(),
    discountAmount: z.coerce.number().min(0).nullable().optional(),
    discountStartDate: z.string().or(z.date()).nullable().optional(),
    discountEndDate: z.string().or(z.date()).nullable().optional(),

    // Step 4: Attributes
    sizeId: z.string().nullable().optional(),
    colorId: z.string().nullable().optional(),
    silhouetteId: z.string().nullable().optional(),
    case: z.string().nullable().optional(),
    band: z.string().nullable().optional(),
    movementType: z.string().nullable().optional(),
    heelHeight: z.string().nullable().optional(),
    width: z.string().nullable().optional(),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

const STEPS = ["Basic Details", "Classification", "Pricing & Discounts", "Attributes", "Review"];

export default function ItemEditPage() {
    const router = useRouter();
    const params = useParams();
    const itemId = params.id as string;

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
    });

    const [loading, setLoading] = useState(true);
    const [fetchingItem, setFetchingItem] = useState(true);
    const [currentItem, setCurrentItem] = useState<any>(null);

    const form = useForm({
        resolver: zodResolver(itemFormSchema),
        defaultValues: {
            brandId: "",
            description: "",
            sku: "",
            itemId: "",
            barCode: "",
            hsCode: "",
            isActive: true,
            unitPrice: 0,
            taxRate1: 0,
            taxRate2: 0,
            discountRate: 0,
            discountAmount: 0,
            segmentId: "",
            divisionId: "",
            categoryId: "",
            subCategoryId: "",
            itemClassId: "",
            itemSubclassId: "",
            channelClassId: "",
            genderId: "",
            seasonId: "",
            uomId: "",
            discountStartDate: null,
            discountEndDate: null,
            sizeId: "",
            colorId: "",
            silhouetteId: "",
            case: "",
            band: "",
            movementType: "",
            heelHeight: "",
            width: "",
        },
        mode: "onChange",
    });

    const watchBrandId = form.watch("brandId");
    const watchCategoryId = form.watch("categoryId");
    const watchItemClassId = form.watch("itemClassId");

    useEffect(() => {
        const fetchMasters = async () => {
            setLoading(true);
            try {
                const [
                    brands, divisions, categories, genders, colors,
                    silhouettes, channelClasses, itemClasses, itemSubclasses,
                    seasons, sizes, segments
                ] = await Promise.all([
                    getBrands(), getDivisions(), getCategories(), getGenders(), getColors(),
                    getSilhouettes(), getChannelClasses(), getItemClasses(), getItemSubclasses(),
                    getSeasons(), getSizes(), getSegments()
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
                });
            } catch (error) {
                console.error("Failed to fetch masters:", error);
                toast.error("Failed to load master data");
            } finally {
                setLoading(false);
            }
        };

        const fetchItem = async () => {
            if (!itemId) return;
            setFetchingItem(true);
            try {
                const result = await getItemById(itemId);
                if (result.status && result.data) {
                    const item = result.data;
                    setCurrentItem(item); // Store item for image display

                    // Transform dates to Date objects if they exist
                    const discountStartDate = item.discountStartDate ? new Date(item.discountStartDate) : null;
                    const discountEndDate = item.discountEndDate ? new Date(item.discountEndDate) : null;

                    form.reset({
                        ...item,
                        // Ensure all master IDs are strings or empty strings if null
                        brandId: item.brandId || "",
                        description: item.description || "",
                        sku: item.sku || "",
                        itemId: item.itemId || "",
                        barCode: item.barCode || "",
                        hsCode: item.hsCode || "",
                        isActive: item.isActive,
                        segmentId: item.segmentId || "",
                        divisionId: item.divisionId || "",
                        categoryId: item.categoryId || "",
                        subCategoryId: item.subCategoryId || "",
                        itemClassId: item.itemClassId || "",
                        itemSubclassId: item.itemSubclassId || "",
                        channelClassId: item.channelClassId || "",
                        genderId: item.genderId || "",
                        seasonId: item.seasonId || "",
                        // uomId removed
                        unitPrice: item.unitPrice || 0,
                        taxRate1: item.taxRate1 || 0,
                        taxRate2: item.taxRate2 || 0,
                        discountRate: item.discountRate || 0,
                        discountAmount: item.discountAmount || 0,
                        discountStartDate: discountStartDate,
                        discountEndDate: discountEndDate,
                        sizeId: item.sizeId || "",
                        colorId: item.colorId || "",
                        silhouetteId: item.silhouetteId || "",
                        case: item.case || "",
                        band: item.band || "",
                        movementType: item.movementType || "",
                        heelHeight: item.heelHeight || "",
                        width: item.width || "",
                    });
                } else {
                    toast.error("Failed to fetch item details");
                    router.push("/erp/items/list");
                }
            } catch (error) {
                console.error("Error fetching item:", error);
                toast.error("Failed to load item details");
            } finally {
                setFetchingItem(false);
            }
        };

        fetchMasters();
        fetchItem();
    }, [itemId, form, router]);

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
            const result = await updateItem(itemId, data);
            if (result.status) {
                toast.success("Item updated successfully");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/erp/items/list");
                });
            } else {
                toast.error(result.message || "Failed to update item");
            }
        } catch (error) {
            console.error("Error updating item:", error);
            toast.error("An unexpected error occurred");
        }
    };

    const getFieldsForStep = (step: number): (keyof ItemFormValues)[] => {
        switch (step) {
            case 0:
                return ["brandId", "segmentId", "sku", "itemId", "barCode", "hsCode", "isActive", "description"];
            case 1:
                return ["divisionId", "categoryId", "subCategoryId", "itemClassId", "itemSubclassId", "channelClassId", "genderId", "seasonId"];
            case 2:
                return ["unitPrice", "taxRate1", "taxRate2", "discountRate", "discountAmount", "discountStartDate", "discountEndDate"];
            case 3:
                return ["sizeId", "colorId", "silhouetteId", "case", "band", "movementType", "heelHeight", "width"];
            default:
                return [];
        }
    };

    if (loading || fetchingItem) {
        return (
            <div className="flex items-center justify-center p-20 min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <PermissionGuard permissions="erp.item.update">
        <div className="container mx-auto py-10 max-w-5xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Edit Item</h1>
                    <p className="text-muted-foreground">Modify item details.</p>
                </div>
                <Link href="/erp/items/list" transitionTypes={["nav-back"]}>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                    </Button>
                </Link>
            </div>

            <Steps steps={STEPS} currentStep={currentStep} />

            {/* Image Display Section */}
            {currentItem?.imageUrl && (
                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle className="text-lg">Current Item Image</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-center">
                            <img
                                src={currentItem.imageUrl}
                                alt={currentItem.itemId}
                                className="max-w-md w-full h-auto rounded-lg border shadow-sm object-contain"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="mt-8">
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                                            name="itemId"
                                            render={({ field }: { field: any }) => (
                                                <FormItem>
                                                    <FormLabel>Item ID <span className="text-red-500">*</span></FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Unique Item ID" {...field} value={field.value ?? ""} disabled />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
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
                                            name="hsCode"
                                            render={({ field }: { field: any }) => (
                                                <FormItem>
                                                    <FormLabel>HS Code</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Harmonized System Code" {...field} value={field.value ?? ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
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
                                            name="taxRate1"
                                            render={({ field }: { field: any }) => (
                                                <FormItem>
                                                    <FormLabel>Tax Rate 1 (%)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} value={field.value ?? ""} />
                                                    </FormControl>
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
                                                                                format(new Date(field.value), "PPP")
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
                                                                        selected={field.value ? new Date(field.value) : undefined}
                                                                        onSelect={field.onChange}
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
                                                                                format(new Date(field.value), "PPP")
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
                                                                        selected={field.value ? new Date(field.value) : undefined}
                                                                        onSelect={field.onChange}
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
                                                <Label className="text-muted-foreground text-xs">Item ID</Label>
                                                <div className="font-medium">{form.getValues("itemId")}</div>
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
                                            <p className="text-sm font-medium">Please review the information above before submitting.</p>
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
                                        Update Item
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </form>
                </Form>
            </div>
        </div>
        </PermissionGuard>
    );
}
