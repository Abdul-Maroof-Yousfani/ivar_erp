"use client";

import { useState, useEffect, addTransitionType, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supplierApi } from "@/lib/api";
import {
  getValuedGrns,
  getAvailableLandedCosts,
  getNextInvoiceNumber,
  createPurchaseInvoice,
} from "@/lib/actions/purchase-invoice";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { PermissionGuard } from "@/components/auth/permission-guard";

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface GRN {
  id: string;
  grnNumber: string;
  supplier?: Supplier;
  purchaseOrder?: {
    vendor?: Supplier;
  };
  items: GRNItem[];
}

interface GRNItem {
  id: string;
  itemId: string;
  description: string;
  receivedQty: number;
  availableQty: number;
  unitPrice: number;
}

interface LandedCost {
  id: string;
  landedCostNumber: string;
  supplier?: Supplier;
  grn?: {
    purchaseOrder?: {
      vendor?: Supplier;
    };
  };
  items: LandedCostItem[];
}

interface LandedCostItem {
  id: string;
  itemId: string;
  description: string;
  qty: number;
  availableQty: number;
  unitCostPKR: number;
}

interface InvoiceItem {
  itemId: string;
  grnItemId?: string;
  landedCostItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
}

export default function CreatePurchaseInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [landedCosts, setLandedCosts] = useState<LandedCost[]>([]);

  const [formData, setFormData] = useState({
    invoiceNumber: "", // Will be auto-generated
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    supplierId: "",
    grnId: "",
    landedCostId: "",
    discountAmount: 0,
    notes: "",
    isApproved: false,
  });

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [selectedLandedCost, setSelectedLandedCost] =
    useState<LandedCost | null>(null);

  useEffect(() => {
    fetchInitialData();
    fetchNextInvoiceNumber(); // Auto-generate invoice number on load
  }, []);

  const fetchInitialData = async () => {
    try {
      console.log("Fetching initial data...");

      const [suppliersData, grnsData, landedCostsData] = await Promise.all([
        supplierApi.getAll(),
        getValuedGrns(),
        getAvailableLandedCosts(),
      ]);

      console.log("API Responses:", {
        suppliers: suppliersData,
        grns: grnsData,
        landedCosts: landedCostsData,
      });

      // Debug GRN structure
      if (grnsData && grnsData.length > 0) {
        console.log("First GRN structure:", grnsData[0]);
        console.log("Total GRNs:", grnsData.length);
      } else {
        console.log("No GRNs found or GRNs array is empty");
      }

      // Debug Landed Cost structure
      if (landedCostsData && landedCostsData.length > 0) {
        console.log("First Landed Cost structure:", landedCostsData[0]);
        console.log("Total Landed Costs:", landedCostsData.length);
      } else {
        console.log("No Landed Costs found or Landed Costs array is empty");
        console.log("Landed Costs response type:", typeof landedCostsData);
        console.log("Landed Costs response:", landedCostsData);
      }

      setSuppliers(suppliersData.data || suppliersData || []);
      setGrns(grnsData || []);
      setLandedCosts(landedCostsData?.data || landedCostsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      console.error("Error details:", (error as any).message);
      // Set empty arrays to prevent undefined errors
      setSuppliers([]);
      setGrns([]);
      setLandedCosts([]);
    }
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      const response = await getNextInvoiceNumber();
      console.log("Next Invoice Number:", response);
      setFormData((prev) => ({
        ...prev,
        invoiceNumber: response.nextInvoiceNumber,
      }));
    } catch (error) {
      console.error("Error fetching next invoice number:", error);
      // Fallback to manual entry if auto-generation fails
    }
  };

  const handleGRNSelection = (grnId: string) => {
    const grn = grns.find((g) => g.id === grnId);
    console.log("Selected GRN:", grn);

    if (grn) {
      setSelectedGRN(grn);
      const supplierId = grn.purchaseOrder?.vendor?.id || grn.supplier?.id;
      setFormData((prev) => ({
        ...prev,
        grnId,
        supplierId: supplierId || "",
        landedCostId: "",
      }));
      setSelectedLandedCost(null);

      // Auto-populate items from GRN
      console.log("GRN Items:", grn.items);
      const grnItems: InvoiceItem[] = grn.items.map((item) => ({
        itemId: item.itemId,
        grnItemId: item.id,
        description: item.description,
        quantity: item.availableQty,
        unitPrice: item.unitPrice || 0, // Use unit price from GRN/PO
        taxRate: 0,
        discountRate: 0,
      }));
      console.log("Mapped GRN Items:", grnItems);
      setItems(grnItems);
    }
  };

  const handleLandedCostSelection = (landedCostId: string) => {
    const landedCost = landedCosts.find((lc) => lc.id === landedCostId);
    console.log("Selected Landed Cost:", landedCost);

    if (landedCost) {
      setSelectedLandedCost(landedCost);
      setFormData((prev) => ({
        ...prev,
        landedCostId,
        supplierId:
          landedCost.supplier?.id ||
          landedCost.grn?.purchaseOrder?.vendor?.id ||
          "",
        grnId: "",
      }));
      setSelectedGRN(null);

      // Auto-populate items from Landed Cost
      console.log("Landed Cost Items:", landedCost.items);
      const lcItems: InvoiceItem[] = landedCost.items.map((item) => ({
        itemId: item.itemId,
        landedCostItemId: item.id,
        description: item.description,
        quantity: item.availableQty,
        unitPrice: item.unitCostPKR,
        taxRate: 0,
        discountRate: 0,
      }));
      console.log("Mapped Landed Cost Items:", lcItems);
      setItems(lcItems);
    }
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        itemId: "",
        description: "",
        quantity: 0,
        unitPrice: 0,
        taxRate: 0,
        discountRate: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const discountAmount = lineTotal * (item.discountRate / 100);
      return sum + (lineTotal - discountAmount);
    }, 0);

    const taxAmount = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const discountAmount = lineTotal * (item.discountRate / 100);
      const discountedAmount = lineTotal - discountAmount;
      return sum + discountedAmount * (item.taxRate / 100);
    }, 0);

    const totalAmount = subtotal + taxAmount - formData.discountAmount;

    return { subtotal, taxAmount, totalAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Debug: Log the data being sent
      console.log("Form Data:", formData);
      console.log("Items:", items);

      // Validate items before sending
      const validItems = items.filter(
        (item) => item.itemId && item.quantity > 0,
      );
      console.log("Valid Items:", validItems);

      if (validItems.length === 0) {
        alert("Please add at least one item with valid data");
        setLoading(false);
        return;
      }

      // Clean up empty string values to undefined for optional UUID fields
      const { isApproved, ...restFormData } = formData;
      const cleanedFormData = {
        ...restFormData,
        grnId: restFormData.grnId || undefined,
        landedCostId: restFormData.landedCostId || undefined,
        dueDate: restFormData.dueDate || undefined,
        notes: restFormData.notes || undefined,
      };

      const payload = {
        ...cleanedFormData,
        items: validItems,
        status: formData.isApproved ? "APPROVED" : undefined,
      };

      console.log("Final Payload:", payload);

      const invoice = await createPurchaseInvoice(payload);

      if (invoice) {
        startTransition(() => {
          addTransitionType("nav-forward");
          router.push("/erp/procurement/purchase-invoice");
        });
      }
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      alert(error.message || "Error creating invoice");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, taxAmount, totalAmount } = calculateTotals();

  return (
    <PermissionGuard permissions="erp.procurement.pi.create">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Create Purchase Invoice</h1>
            <p className="text-gray-600">Create a new supplier invoice</p>
          </div>
        </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  disabled
                  className="font-medium"
                  placeholder="Auto-generating..."
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="invoiceDate">Invoice Date *</Label>
                <DatePicker
                  value={formData.invoiceDate}
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, invoiceDate: date }))
                  }
                  placeholder="Select Invoice Date"
                />
              </div>
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <DatePicker
                  value={formData.dueDate}
                  onChange={(date) =>
                    setFormData((prev) => ({ ...prev, dueDate: date }))
                  }
                  placeholder="Select Due Date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grn">Select GRN</Label>
                <Select
                  value={formData.grnId}
                  onValueChange={handleGRNSelection}
                  disabled={!!formData.landedCostId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select GRN" />
                  </SelectTrigger>
                  <SelectContent>
                    {grns.map((grn) => (
                      <SelectItem key={grn.id} value={grn.id}>
                        {grn.grnNumber} -{" "}
                        {grn.purchaseOrder?.vendor?.name ||
                          grn.supplier?.name ||
                          "Unknown Supplier"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="landedCost">Select Landed Cost</Label>
                <Select
                  value={formData.landedCostId}
                  onValueChange={handleLandedCostSelection}
                  disabled={!!formData.grnId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Landed Cost" />
                  </SelectTrigger>
                  <SelectContent>
                    {landedCosts.map((lc) => (
                      <SelectItem key={lc.id} value={lc.id}>
                        {lc.landedCostNumber} -{" "}
                        {lc.supplier?.name ||
                          lc.grn?.purchaseOrder?.vendor?.name ||
                          "Unknown Supplier"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, supplierId: value }))
                }
                disabled={true}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Items */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, "description", e.target.value)
                        }
                        placeholder="Item description"
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "quantity",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "unitPrice",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label>Tax Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.taxRate}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "taxRate",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Discount (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.discountRate}
                        onChange={(e) =>
                          updateItem(
                            index,
                            "discountRate",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totals and Notes */}
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax Amount:</span>
                  <span>{taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invoice Discount:</span>
                  <span>-{formData.discountAmount.toLocaleString()}</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Amount:</span>
                  <span>{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end">
          <Link
            href="/erp/procurement/purchase-invoice"
            transitionTypes={["nav-forward"]}
          >
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Invoice"}
          </Button>
        </div>
      </form>
    </div>
    </PermissionGuard>
  );
}
