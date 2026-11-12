"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  supplierApi,
  itemApi,
  warehouseApi,
  productionApi,
  inventoryApi,
  fabricVendorTrackerApi,
  Supplier,
  MasterItem,
  Warehouse,
  FabricVendorTracker,
  ProductionCostingResult,
} from "@/lib/api";
import {
  Calculator,
  Layers,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Scissors,
  Building2,
  Plus,
  Trash2,
  RotateCcw,
  Lock,
  Unlock,
} from "lucide-react";

export interface ReceivingLine {
  id: string;
  articleItemId: string;
  sizeName: string;
  qtyTotalReceived: number | "";
  qtyBGrade: number | "";
  cmtRate: number | "";
  qtyFabricUsed?: number | "";
}

interface ProductionEntryFormProps {
  initialTrackerId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function ProductionEntryForm({
  initialTrackerId,
  onSuccess,
  onClose,
}: ProductionEntryFormProps) {
  // Dropdown options
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fabricItems, setFabricItems] = useState<MasterItem[]>([]);
  const [articleItems, setArticleItems] = useState<MasterItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [trackers, setTrackers] = useState<FabricVendorTracker[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Stage 1: Fabric & Vendor Details
  const [trackerId, setTrackerId] = useState<string>(initialTrackerId || "");
  const [isFieldsLocked, setIsFieldsLocked] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [fabricItemId, setFabricItemId] = useState("");
  const [fabricWarehouseId, setFabricWarehouseId] = useState("");
  const [qtyFabricUsed, setQtyFabricUsed] = useState<number | "">("");
  const [fabricRate, setFabricRate] = useState<number | "">("");

  // Active Tracker metadata
  const activeTracker = useMemo(() => {
    if (!trackerId) return null;
    return trackers.find((t) => t.id === trackerId) || null;
  }, [trackerId, trackers]);

  const activeTrackerRemaining = useMemo(() => {
    if (!activeTracker) return 0;
    const iss = Number(activeTracker.qtyIssued || 0);
    const usd = Number(activeTracker.qtyUsed || 0);
    const ret = Number(activeTracker.qtyReturned || 0);
    const shrt = Number(activeTracker.qtyShortage || 0);
    return Math.max(0, iss - usd - ret - shrt);
  }, [activeTracker]);

  // Only show active trackers that still have remaining fabric balance (unless already selected)
  const availableTrackers = useMemo(() => {
    return trackers.filter((t) => {
      if (t.id === trackerId) return true;
      const iss = Number(t.qtyIssued || 0);
      const usd = Number(t.qtyUsed || 0);
      const ret = Number(t.qtyReturned || 0);
      const shrt = Number(t.qtyShortage || 0);
      const rem = iss - usd - ret - shrt;
      return t.status !== "COMPLETED" && rem > 0.001;
    });
  }, [trackers, trackerId]);

  // Stage 2: Dynamic Multi-Article / Size Receiving Matrix (Step 2 - No hardcoded sizes)
  const [lines, setLines] = useState<ReceivingLine[]>([
    {
      id: "line-1",
      articleItemId: "",
      sizeName: "",
      qtyFabricUsed: "",
      qtyTotalReceived: "",
      qtyBGrade: 0,
      cmtRate: "",
    },
  ]);
  const [deductBGradeCmt, setDeductBGradeCmt] = useState(false);

  // Stage 3: Warehouses & Logistics
  const [aGradeWarehouseId, setAGradeWarehouseId] = useState("");
  const [bGradeWarehouseId, setBGradeWarehouseId] = useState("");
  const [productionDate, setProductionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");

  // Real-time stock for selected raw fabric warehouse
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  // Apply tracker data helper
  const applyTrackerData = useCallback(
    (tracker: FabricVendorTracker, fabricsList?: MasterItem[]) => {
      setTrackerId(tracker.id);
      if (tracker.supplierId) setSupplierId(tracker.supplierId);
      if (tracker.itemId) setFabricItemId(tracker.itemId);
      if (tracker.warehouseId) setFabricWarehouseId(tracker.warehouseId);

      const iss = Number(tracker.qtyIssued || 0);
      const usd = Number(tracker.qtyUsed || 0);
      const ret = Number(tracker.qtyReturned || 0);
      const shrt = Number(tracker.qtyShortage || 0);
      const remaining = Math.max(0, iss - usd - ret - shrt);
      setQtyFabricUsed(remaining);

      const itemObj = tracker.item as
        | (MasterItem & { unitCost?: number; unitPrice?: number })
        | undefined;
      const itemRate = Number(itemObj?.unitCost || itemObj?.unitPrice || 0);
      if (itemRate > 0) {
        setFabricRate(itemRate);
      } else {
        const fl = fabricsList || fabricItems;
        const match = fl.find((f) => f.id === tracker.itemId);
        const matchRate = Number(match?.unitCost || match?.unitPrice || 0);
        if (matchRate > 0) setFabricRate(matchRate);
      }
    },
    [fabricItems],
  );

  // Handle tracker selection change
  const handleTrackerChange = (selectedId: string) => {
    if (!selectedId || selectedId === "direct") {
      setTrackerId("");
      setIsFieldsLocked(false);
      return;
    }
    const found = trackers.find((t) => t.id === selectedId);
    if (found) {
      applyTrackerData(found);
      setIsFieldsLocked(true);
      toast.info(
        `Selected Fabric Issue #${found.trackerNumber}: Stage 1 auto-filled.`,
      );
    }
  };

  // Fetch options on mount
  useEffect(() => {
    let ignore = false;
    const fetchOptions = async () => {
      try {
        const [
          suppliersRes,
          fabricsRes,
          allItemsRes,
          warehousesRes,
          trackersRes,
        ] = await Promise.all([
          supplierApi.getAll(),
          itemApi.getAll({ itemType: "RAW_FABRIC" }),
          itemApi.getAll(),
          warehouseApi.getAll(),
          fabricVendorTrackerApi.getAll().catch(() => []),
        ]);

        if (ignore) return;
        const supps = suppliersRes.data || [];
        const fabrics = fabricsRes.data || [];
        const allItems = allItemsRes.data || [];
        const whs = warehousesRes || [];
        const trks = Array.isArray(trackersRes) ? trackersRes : [];

        setSuppliers(supps);
        setFabricItems(fabrics);
        const garments = allItems.filter((i) => i.itemType !== "RAW_FABRIC");
        setArticleItems(garments.length > 0 ? garments : allItems);
        setWarehouses(whs);
        setTrackers(trks);

        // Pre-select dedicated B-Grade warehouse as per IVAR rules
        const bWh = whs.find(
          (w) =>
            w.type === "B_GRADE" ||
            w.code === "WH-B-GRADE" ||
            w.name.toLowerCase().includes("b grade"),
        );
        if (bWh) setBGradeWarehouseId(bWh.id);

        // Pre-select primary finished goods warehouse (non B-Grade)
        const primaryAWh = whs.find(
          (w) => w.type !== "B_GRADE" && w.code !== "WH-B-GRADE",
        );
        if (primaryAWh) setAGradeWarehouseId((prev) => prev || primaryAWh.id);

        // If initialTrackerId was provided, auto-apply it
        if (initialTrackerId) {
          const found = trks.find((t) => t.id === initialTrackerId);
          if (found) {
            applyTrackerData(found, fabrics);
            setIsFieldsLocked(true);
          }
        }
      } catch (error) {
        if (!ignore) {
          console.error("Failed to load options:", error);
          toast.error("Failed to load dropdown options");
        }
      } finally {
        if (!ignore) {
          setLoadingOptions(false);
        }
      }
    };

    void fetchOptions();
    return () => {
      ignore = true;
    };
  }, [initialTrackerId, applyTrackerData]);

  // React to initialTrackerId changes
  useEffect(() => {
    if (initialTrackerId && trackers.length > 0) {
      const found = trackers.find((t) => t.id === initialTrackerId);
      if (found) {
        queueMicrotask(() => {
          applyTrackerData(found);
          setIsFieldsLocked(true);
        });
      }
    }
  }, [initialTrackerId, trackers, applyTrackerData]);

  // Fetch available stock whenever fabricItemId or fabricWarehouseId changes
  useEffect(() => {
    let isCancelled = false;
    if (fabricItemId && fabricWarehouseId) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setLoadingStock(true);
          setAvailableStock(null);
        }
      });
      inventoryApi
        .getStockLevel(fabricItemId, fabricWarehouseId)
        .then((res) => {
          if (!isCancelled) {
            setAvailableStock(Number(res.totalQuantity) || 0);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch fabric stock level:", err);
          if (!isCancelled) {
            setAvailableStock(null);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setLoadingStock(false);
          }
        });
    } else {
      queueMicrotask(() => {
        if (!isCancelled) {
          setAvailableStock(null);
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [fabricItemId, fabricWarehouseId]);

  // Handle Fabric change
  const handleFabricChange = (id: string) => {
    setFabricItemId(id);
    const fabric = fabricItems.find((f) => f.id === id);
    const rate = Number(fabric?.unitCost || fabric?.unitPrice || 0);
    if (rate > 0) {
      setFabricRate(rate);
    }
  };

  // Grid row actions
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${Math.random()}`,
        articleItemId: "",
        sizeName: "",
        qtyFabricUsed: "",
        qtyTotalReceived: "",
        qtyBGrade: 0,
        cmtRate: prev[prev.length - 1]?.cmtRate || "",
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) {
      toast.warning("At least one finished garment row is required.");
      return;
    }
    setLines((prev) => {
      const updated = prev.filter((l) => l.id !== id);
      const hasAnyLineFabric = updated.some(
        (l) =>
          l.qtyFabricUsed !== undefined &&
          l.qtyFabricUsed !== "" &&
          Number(l.qtyFabricUsed) > 0,
      );
      if (hasAnyLineFabric) {
        const sum = updated.reduce(
          (acc, l) => acc + (Number(l.qtyFabricUsed) || 0),
          0,
        );
        setQtyFabricUsed(sum);
      }
      return updated;
    });
  };

  const handleLineArticleChange = (lineId: string, newArticleId: string) => {
    const art = articleItems.find((a) => a.id === newArticleId);
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              articleItemId: newArticleId,
              sizeName: art?.size?.name || "Standard",
            }
          : l,
      ),
    );
  };

  const handleLineFieldChange = (
    lineId: string,
    field: "qtyTotalReceived" | "qtyBGrade" | "cmtRate" | "qtyFabricUsed",
    val: string | number,
  ) => {
    setLines((prev) => {
      const updated = prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              [field]: val === "" ? "" : Number(val),
            }
          : l,
      );

      // When line fabric changes, automatically update Stage 1 total fabric
      if (field === "qtyFabricUsed") {
        const hasAnyLineFabric = updated.some(
          (l) =>
            l.qtyFabricUsed !== undefined &&
            l.qtyFabricUsed !== "" &&
            Number(l.qtyFabricUsed) > 0,
        );
        if (hasAnyLineFabric) {
          const sum = updated.reduce(
            (acc, l) => acc + (Number(l.qtyFabricUsed) || 0),
            0,
          );
          setQtyFabricUsed(sum);
        }
      }

      return updated;
    });
  };

  // Auto-Add all sizes of selected style/product (No hardcoding)
  const handleAutoAddAllSizes = (selectedArticleId: string) => {
    const baseItem = articleItems.find((a) => a.id === selectedArticleId);
    if (!baseItem) return;

    const baseName = (baseItem.description || baseItem.sku || "")
      .split("-")[0]
      .trim();
    const matchingVariants = articleItems.filter((i) => {
      const iName = (i.description || i.sku || "").split("-")[0].trim();
      return iName.toLowerCase() === baseName.toLowerCase();
    });

    if (matchingVariants.length > 0) {
      const currentCmt = lines[0]?.cmtRate || "";
      const newLines: ReceivingLine[] = matchingVariants.map((v, idx) => ({
        id: `line-variant-${Date.now()}-${idx}`,
        articleItemId: v.id,
        sizeName: v.size?.name || "Standard",
        qtyFabricUsed: "",
        qtyTotalReceived: "",
        qtyBGrade: 0,
        cmtRate: currentCmt,
      }));
      setLines(newLines);
      toast.success(
        `Loaded all ${matchingVariants.length} sizes for "${baseName}" into receiving grid!`,
      );
    } else {
      toast.info("Only single variant found for this article.");
    }
  };

  // Sample Data & Clear
  const handleLoadSampleData = () => {
    setQtyFabricUsed(2700);
    setFabricRate(875);
    const firstGarment = articleItems[0]?.id || "";
    const firstGarmentSize = articleItems[0]?.size?.name || "Standard";
    setLines([
      {
        id: "line-sample",
        articleItemId: firstGarment,
        sizeName: firstGarmentSize,
        qtyFabricUsed: 2700,
        qtyTotalReceived: 1887,
        qtyBGrade: 19,
        cmtRate: 785,
      },
    ]);
    setNotes(
      "COSTING FILE.xlsx — Row 3 Example Batch (1,887 pcs, 19 B-grade, 2,700m @ Rs 875)",
    );
    toast.info(
      "Loaded Excel Row 3 sample: 2,700m, Rs 875/m, 1,887 pcs, 19 B-grade, Rs 785 CMT",
    );
  };

  const handleClearForm = () => {
    setTrackerId("");
    setIsFieldsLocked(false);
    setSupplierId("");
    setFabricItemId("");
    setFabricWarehouseId("");
    setQtyFabricUsed("");
    setFabricRate("");
    setLines([
      {
        id: "line-1",
        articleItemId: "",
        sizeName: "",
        qtyFabricUsed: "",
        qtyTotalReceived: "",
        qtyBGrade: 0,
        cmtRate: "",
      },
    ]);
    setDeductBGradeCmt(false);
    setAGradeWarehouseId("");
    setNotes("");
    setAvailableStock(null);
    toast.info("Form cleared");
  };

  // Aggregate Batch Receiving Totals
  const batchTotals = useMemo(() => {
    let totalRecv = 0;
    let totalB = 0;
    let hasValidLine = false;

    lines.forEach((l) => {
      const q = Number(l.qtyTotalReceived || 0);
      const b = Number(l.qtyBGrade || 0);
      if (q > 0) {
        totalRecv += q;
        totalB += b;
        hasValidLine = true;
      }
    });

    const totalA = Math.max(0, totalRecv - totalB);
    return { totalRecv, totalB, totalA, hasValidLine };
  }, [lines]);

  // Real-time Costing Calculation Engine (Matches COSTING FILE.xlsx and Production Flow Document)
  const costing: ProductionCostingResult | null = useMemo(() => {
    const fRate = Number(fabricRate || 0);
    const { totalRecv, totalB, totalA } = batchTotals;

    // Check if lines specify per-item fabric
    const hasLineFabric = lines.some(
      (l) =>
        l.qtyFabricUsed !== undefined &&
        l.qtyFabricUsed !== "" &&
        Number(l.qtyFabricUsed) > 0,
    );
    const totalLinesFabric = lines.reduce(
      (acc, l) => acc + (Number(l.qtyFabricUsed) || 0),
      0,
    );
    const fUsed = hasLineFabric ? totalLinesFabric : Number(qtyFabricUsed || 0);

    if (totalRecv <= 0 || fUsed <= 0) return null;

    let batchTotalBill = 0;
    let batchBTotalValue = 0;
    let batchATotalValue = 0;
    let batchVendorCmtBill = 0;

    const calculatedItems = lines.map((l) => {
      const qTot = Number(l.qtyTotalReceived || 0);
      const qB = Number(l.qtyBGrade || 0);
      const qA = Math.max(0, qTot - qB);
      const cmt = Number(l.cmtRate || 0);

      const lineFabric = hasLineFabric
        ? Number(l.qtyFabricUsed) || 0
        : totalRecv > 0
          ? (qTot / totalRecv) * fUsed
          : 0;

      const lineCons = qTot > 0 ? lineFabric / qTot : 0;
      const lineFabCostPerPc = lineCons * fRate;

      const initNet = lineFabCostPerPc + cmt;
      const lineBill = initNet * qTot;
      const bVal = initNet * 0.5;
      const bTot = qB * bVal;
      const aTot = lineBill - bTot;
      const aFinal = qA > 0 ? aTot / qA : initNet;
      const cmtBill = (deductBGradeCmt ? qA : qTot) * cmt;

      batchTotalBill += lineBill;
      batchBTotalValue += bTot;
      batchATotalValue += aTot;
      batchVendorCmtBill += cmtBill;

      return {
        articleItemId: l.articleItemId,
        sizeName: l.sizeName,
        qtyFabricUsed: lineFabric,
        consumption: lineCons,
        qtyTotalReceived: qTot,
        qtyAGrade: qA,
        qtyBGrade: qB,
        cmtRate: cmt,
        fabricCostPerPc: lineFabCostPerPc,
        initialNetCost: initNet,
        totalBill: lineBill,
        bUnitValue: bVal,
        bTotalValue: bTot,
        aTotalValue: aTot,
        aFinalUnitCost: aFinal,
        vendorCmtBillAmount: cmtBill,
      };
    });

    const overallCons = totalRecv > 0 ? fUsed / totalRecv : 0;
    const avgInitialNet = batchTotalBill / totalRecv;
    const avgAFinal = totalA > 0 ? batchATotalValue / totalA : avgInitialNet;
    const avgBUnit =
      totalB > 0 ? batchBTotalValue / totalB : avgInitialNet * 0.5;
    const avgCmt =
      batchVendorCmtBill / (deductBGradeCmt ? totalA : totalRecv || 1);

    return {
      qtyFabricUsed: fUsed,
      fabricRate: fRate,
      qtyTotalReceived: totalRecv,
      qtyAGrade: totalA,
      qtyBGrade: totalB,
      cmtRate: Number(avgCmt.toFixed(2)),
      deductBGradeCmt,
      consumption: Number(overallCons.toFixed(6)),
      fabricCostPerPc: Number((overallCons * fRate).toFixed(2)),
      cmtCostPerPc: Number(avgCmt.toFixed(2)),
      initialNetCost: Number(avgInitialNet.toFixed(2)),
      totalBill: Number(batchTotalBill.toFixed(2)),
      bUnitValue: Number(avgBUnit.toFixed(2)),
      bTotalValue: Number(batchBTotalValue.toFixed(2)),
      aTotalValue: Number(batchATotalValue.toFixed(2)),
      aFinalUnitCost: Number(avgAFinal.toFixed(2)),
      vendorCmtBillAmount: Number(batchVendorCmtBill.toFixed(2)),
      items: calculatedItems,
    };
  }, [qtyFabricUsed, fabricRate, lines, batchTotals, deductBGradeCmt]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error("Please select a CMT Vendor / Stitching Supplier.");
      return;
    }
    if (!fabricItemId) {
      toast.error("Please select the Raw Fabric Item.");
      return;
    }
    if (!fabricWarehouseId) {
      toast.error(
        "Please select the Fabric Source Location (Vendor Warehouse).",
      );
      return;
    }
    if (!qtyFabricUsed || Number(qtyFabricUsed) <= 0) {
      toast.error("Please enter the fabric quantity consumed.");
      return;
    }
    if (!fabricRate || Number(fabricRate) <= 0) {
      toast.error("Please enter the fabric rate per meter.");
      return;
    }
    if (!aGradeWarehouseId) {
      toast.error("Please select the A-Grade Finished Stock Warehouse.");
      return;
    }
    if (!bGradeWarehouseId) {
      toast.error("Please select the Dedicated B-Grade Warehouse.");
      return;
    }

    // Validate receiving lines
    const validLines = lines.filter(
      (l) => l.articleItemId && Number(l.qtyTotalReceived) > 0,
    );
    if (validLines.length === 0) {
      toast.error(
        "Please add at least one finished garment row with quantity > 0.",
      );
      return;
    }

    for (const l of validLines) {
      const qTot = Number(l.qtyTotalReceived);
      const qB = Number(l.qtyBGrade || 0);
      if (qB > qTot) {
        toast.error(
          `B-grade defective pieces cannot exceed total received pieces for Size/Item: ${l.sizeName || l.articleItemId}.`,
        );
        return;
      }
      if (Number(l.cmtRate) < 0 || l.cmtRate === "") {
        toast.error(
          `Please provide an agreed CMT stitching rate for Size/Item: ${l.sizeName || l.articleItemId}.`,
        );
        return;
      }
    }

    // If multiple lines exist and at least one has specific fabric entered, ensure all lines have fabric entered
    const hasAnyLineFabric = validLines.some(
      (l) =>
        l.qtyFabricUsed !== undefined &&
        l.qtyFabricUsed !== "" &&
        Number(l.qtyFabricUsed) > 0,
    );
    if (hasAnyLineFabric && validLines.length > 1) {
      const missingFabricLine = validLines.find(
        (l) =>
          l.qtyFabricUsed === undefined ||
          l.qtyFabricUsed === "" ||
          Number(l.qtyFabricUsed) <= 0,
      );
      if (missingFabricLine) {
        toast.error(
          `Please enter fabric consumption (m) for all garment rows, or leave them empty to distribute proportionally.`,
        );
        return;
      }
    }

    if (
      activeTracker &&
      Number(qtyFabricUsed) > activeTrackerRemaining + 0.001
    ) {
      toast.error(
        `Entered fabric consumption (${qtyFabricUsed}m) exceeds remaining fabric with vendor (${activeTrackerRemaining.toFixed(2)}m).`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId,
        fabricItemId,
        fabricWarehouseId,
        trackerId: trackerId || undefined,
        qtyFabricUsed: Number(qtyFabricUsed),
        fabricRate: Number(fabricRate),
        items: validLines.map((l) => ({
          articleItemId: l.articleItemId,
          sizeName: l.sizeName || undefined,
          qtyTotalReceived: Number(l.qtyTotalReceived),
          qtyBGrade: Number(l.qtyBGrade || 0),
          cmtRate: Number(l.cmtRate),
          qtyFabricUsed:
            l.qtyFabricUsed !== "" && l.qtyFabricUsed !== undefined
              ? Number(l.qtyFabricUsed)
              : undefined,
        })),
        deductBGradeCmt,
        aGradeWarehouseId,
        bGradeWarehouseId,
        productionDate,
        notes: notes || undefined,
        autoApproveInvoice: false,
      };

      const res = await productionApi.create(payload);

      toast.success(
        `Production Batch #${res.batchNumber} recorded successfully! Stock routed to A/B warehouses and CMT Invoice #${res.purchaseInvoice?.invoiceNumber || ""} generated.`,
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to create production batch:", err);
      const errMsg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to record production batch";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[88vh] bg-background">
      {/* ── Single Unified Header & Quick Actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b bg-muted/20 shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              Record Production & Garment Costing
              <Badge
                variant="outline"
                className="text-[11px] font-mono border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10"
              >
                8-Stage IVAR Flow
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Direct fabric consumption, multi-size quality grading, 50% B-loss
              absorption, and auto-generated CMT invoice.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadSampleData}
            className="text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 font-medium h-8"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-indigo-500" />
            Fill Sample Row 3 Data
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearForm}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Clear Form
          </Button>
        </div>
      </div>

      {/* ── Main Form Scrollable Workstation (Full Width) ── */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
      >
            {/* ── Stage 1: Fabric & Vendor Allocation ── */}
            <Card className="border border-border/80 shadow-2xs">
              <CardHeader className="py-3 px-4 border-b bg-muted/15 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Scissors className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Stage 1: Fabric Issue & Vendor Allocation
                </CardTitle>
                <div className="flex items-center gap-2">
                  {activeTracker && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 font-mono"
                    >
                      Linked: {activeTracker.trackerNumber}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    Raw Material
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* ── Primary Fabric Issue / Consignment Tracker Selector ── */}
                <div className="rounded-xl border border-border bg-muted/40 dark:bg-muted/20 p-3.5 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Scissors className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Select Fabric Issue (Vendor Job Order)
                      <span className="text-destructive">*</span>
                    </Label>
                    {activeTracker ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          Remaining: {activeTrackerRemaining.toLocaleString()}m
                          with Vendor
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => setIsFieldsLocked(!isFieldsLocked)}
                          title={
                            isFieldsLocked
                              ? "Click to unlock fields for manual override"
                              : "Click to lock fields"
                          }
                        >
                          {isFieldsLocked ? (
                            <>
                              <Lock className="h-3 w-3 mr-1 text-indigo-600 dark:text-indigo-400" />{" "}
                              Locked
                            </>
                          ) : (
                            <>
                              <Unlock className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />{" "}
                              Unlocked
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Select a prior fabric issue or choose direct entry
                      </span>
                    )}
                  </div>

                  <Select
                    value={trackerId || "direct"}
                    onValueChange={(val) =>
                      handleTrackerChange(val === "direct" ? "" : val)
                    }
                    disabled={loadingOptions}
                  >
                    <SelectTrigger className="w-full text-xs h-9.5 bg-background font-medium border-input focus:ring-indigo-500">
                      <SelectValue placeholder="Select Fabric Issue / Consignment Tracker..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="direct"
                        className="text-xs font-semibold text-foreground"
                      >
                        ⚡ Direct / Standalone Entry (No prior fabric issue
                        recorded)
                      </SelectItem>
                      {availableTrackers.map((t) => {
                        const iss = Number(t.qtyIssued || 0);
                        const rem = Math.max(
                          0,
                          iss -
                            Number(t.qtyUsed || 0) -
                            Number(t.qtyReturned || 0) -
                            Number(t.qtyShortage || 0),
                        );
                        return (
                          <SelectItem
                            key={t.id}
                            value={t.id}
                            className="text-xs"
                          >
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              [{t.trackerNumber}]
                            </span>{" "}
                            <span className="font-semibold text-foreground">
                              {t.supplier?.name}
                            </span>{" "}
                            —{" "}
                            <span className="text-muted-foreground">
                              {t.item?.sku}
                            </span>{" "}
                            <span className="text-muted-foreground font-mono">
                              ({rem.toLocaleString()}m rem. of{" "}
                              {iss.toLocaleString()}m)
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  {activeTracker && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-[11px] font-mono">
                      <div className="bg-background/80 dark:bg-background/50 p-2 rounded-lg border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-medium">
                          CMT Vendor
                        </span>
                        <span className="font-bold text-foreground truncate block">
                          {activeTracker.supplier?.name}
                        </span>
                      </div>
                      <div className="bg-background/80 dark:bg-background/50 p-2 rounded-lg border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-medium">
                          Raw Fabric
                        </span>
                        <span className="font-bold text-foreground truncate block">
                          {activeTracker.item?.sku}
                        </span>
                      </div>
                      <div className="bg-background/80 dark:bg-background/50 p-2 rounded-lg border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-medium">
                          Fabric Issued
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {Number(activeTracker.qtyIssued).toLocaleString()} m
                        </span>
                      </div>
                      <div className="bg-background/80 dark:bg-background/50 p-2 rounded-lg border border-border/60">
                        <span className="text-muted-foreground block text-[10px] uppercase font-sans font-medium">
                          Balance Remaining
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {activeTrackerRemaining.toLocaleString()} m
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vendor & Fabric Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      CMT Vendor (Stitching Supplier){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={supplierId}
                      onValueChange={setSupplierId}
                      disabled={
                        loadingOptions ||
                        (Boolean(activeTracker) && isFieldsLocked)
                      }
                    >
                      <SelectTrigger
                        className={`w-full text-xs h-9 bg-background ${Boolean(activeTracker) && isFieldsLocked ? "bg-muted/40 cursor-not-allowed opacity-85" : ""}`}
                      >
                        <SelectValue placeholder="Select CMT Supplier..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id}
                            className="text-xs"
                          >
                            {s.name} [{s.code}]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeTracker && isFieldsLocked && (
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5 text-indigo-500" /> Linked
                        to {activeTracker.trackerNumber}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-foreground">
                        Raw Fabric Item{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      {loadingStock ? (
                        <span className="text-[10px] font-mono text-muted-foreground animate-pulse">
                          Checking stock...
                        </span>
                      ) : availableStock !== null ? (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          WH Stock: {availableStock.toLocaleString()}m
                        </span>
                      ) : null}
                    </div>
                    <Select
                      value={fabricItemId}
                      onValueChange={handleFabricChange}
                      disabled={
                        loadingOptions ||
                        (Boolean(activeTracker) && isFieldsLocked)
                      }
                    >
                      <SelectTrigger
                        className={`w-full text-xs h-9 bg-background ${Boolean(activeTracker) && isFieldsLocked ? "bg-muted/40 cursor-not-allowed opacity-85" : ""}`}
                      >
                        <SelectValue placeholder="Select Raw Fabric SKU..." />
                      </SelectTrigger>
                      <SelectContent>
                        {fabricItems.map((f) => (
                          <SelectItem
                            key={f.id}
                            value={f.id}
                            className="text-xs"
                          >
                            {f.sku} - {f.description || f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeTracker && isFieldsLocked && (
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5 text-indigo-500" /> Linked
                        to {activeTracker.trackerNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Warehouse Location & Consumption Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      Fabric Source WH (Vendor WH){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={fabricWarehouseId}
                      onValueChange={setFabricWarehouseId}
                      disabled={
                        loadingOptions ||
                        (Boolean(activeTracker) && isFieldsLocked)
                      }
                    >
                      <SelectTrigger
                        className={`w-full text-xs h-9 bg-background ${Boolean(activeTracker) && isFieldsLocked ? "bg-muted/40 cursor-not-allowed opacity-85" : ""}`}
                      >
                        <SelectValue placeholder="Select Warehouse..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem
                            key={w.id}
                            value={w.id}
                            className="text-xs"
                          >
                            [{w.code}] {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-foreground">
                        Fabric Consumed (Meters){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      {activeTracker && activeTrackerRemaining > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setQtyFabricUsed(activeTrackerRemaining)
                          }
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold font-mono"
                        >
                          Use Remaining ({activeTrackerRemaining}m)
                        </button>
                      ) : availableStock !== null && availableStock > 0 ? (
                        <button
                          type="button"
                          onClick={() => setQtyFabricUsed(availableStock)}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold font-mono"
                        >
                          Use Max ({availableStock}m)
                        </button>
                      ) : null}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 2700"
                      value={qtyFabricUsed}
                      onChange={(e) =>
                        setQtyFabricUsed(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="h-9 text-xs font-mono bg-background"
                      required
                    />
                    {activeTracker &&
                      Number(qtyFabricUsed) > activeTrackerRemaining && (
                        <p className="text-[10px] text-destructive font-semibold">
                          Warning: Exceeds remaining balance (
                          {activeTrackerRemaining}m)
                        </p>
                      )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      Fabric Rate / Meter (PKR){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 875"
                      value={fabricRate}
                      onChange={(e) =>
                        setFabricRate(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      className="h-9 text-xs font-mono bg-background"
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Stage 2: Dynamic Multi-Article / Size Receiving Matrix (Step 2 requirement) ── */}
            <Card className="border border-border/80 shadow-2xs">
              <CardHeader className="py-3 px-4 border-b bg-muted/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Stage 2: Finished Garment Receiving & Quality Grading Matrix
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Receive multiple articles or sizes. Per-item Fabric (m) sets
                    consumption per article (CONS = Fabric ÷ Total Pcs).
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddLine}
                    className="h-7 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Size / Item Row
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Style Quick-Loader helper */}
                <div className="p-3 bg-muted/30 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <strong>Quick Size Loader:</strong> Pick an article to load
                    all its size variants at once:
                  </span>
                  <Select onValueChange={handleAutoAddAllSizes}>
                    <SelectTrigger className="w-full sm:w-[260px] bg-background border-input h-7.5 text-xs">
                      <SelectValue placeholder="Auto-Load All Sizes for Style..." />
                    </SelectTrigger>
                    <SelectContent>
                      {articleItems.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          {a.sku} ({a.size?.name || "Standard"}) -{" "}
                          {a.description || a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Receiving Table Grid */}
                {/* Receiving & Costing Table Grid (Full Width) */}
                <div className="overflow-x-auto min-w-full">
                  <Table className="text-xs min-w-[1100px] w-full">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="min-w-[220px] font-bold">
                          Finished Article & Size (Database)
                        </TableHead>
                        <TableHead
                          className="w-[100px] min-w-[100px] font-bold text-center text-primary whitespace-nowrap"
                          title="Fabric meters consumed for this item"
                        >
                          Fabric (m)
                        </TableHead>
                        <TableHead
                          className="w-[90px] min-w-[90px] font-bold text-center text-primary whitespace-nowrap"
                          title="Consumption = Fabric ÷ Total Pcs"
                        >
                          CONS (m/pc)
                        </TableHead>
                        <TableHead className="w-[95px] min-w-[95px] font-bold text-center whitespace-nowrap">
                          Total (A + B)
                        </TableHead>
                        <TableHead className="w-[105px] min-w-[105px] font-bold text-center text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          Defect (B)
                        </TableHead>
                        <TableHead className="w-[95px] min-w-[95px] font-bold text-center text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          Sound (A)
                        </TableHead>
                        <TableHead className="w-[100px] min-w-[100px] font-bold text-right whitespace-nowrap">
                          Vendor CMT
                        </TableHead>
                        <TableHead className="w-[105px] min-w-[105px] font-bold text-right text-muted-foreground whitespace-nowrap">
                          Initial Net
                        </TableHead>
                        <TableHead className="w-[125px] min-w-[125px] font-bold text-right text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          Recalc A-Cost
                        </TableHead>
                        <TableHead className="w-[115px] min-w-[115px] font-bold text-right text-foreground whitespace-nowrap pr-3">
                          Total Line Bill
                        </TableHead>
                        <TableHead className="w-[40px] min-w-[40px] text-center"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, idx) => {
                        const qTot = Number(line.qtyTotalReceived || 0);
                        const qB = Number(line.qtyBGrade || 0);
                        const qA = Math.max(0, qTot - qB);
                        const itemCost = costing?.items?.[idx];

                        return (
                          <TableRow key={line.id} className="hover:bg-muted/20">
                            {/* 1. Article Selector with Size display */}
                            <TableCell className="p-2 min-w-[220px]">
                              <Select
                                value={line.articleItemId}
                                onValueChange={(val) =>
                                  handleLineArticleChange(line.id, val)
                                }
                              >
                                <SelectTrigger className="w-full h-8 text-xs bg-background border-input">
                                  <SelectValue placeholder="Select Article / SKU..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {articleItems.map((a) => (
                                    <SelectItem
                                      key={a.id}
                                      value={a.id}
                                      className="text-xs"
                                    >
                                      <span className="font-semibold">
                                        {a.sku}
                                      </span>
                                      {a.size?.name && (
                                        <Badge
                                          variant="outline"
                                          className="ml-1.5 text-[10px] py-0 px-1 tabular-nums font-semibold"
                                        >
                                          Size: {a.size.name}
                                        </Badge>
                                      )}
                                      <span className="text-muted-foreground ml-1.5 truncate max-w-[150px]">
                                        — {a.description}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {line.sizeName && (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <span>Assigned Size:</span>
                                  <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 text-[10px] tabular-nums font-semibold py-0">
                                    {line.sizeName}
                                  </Badge>
                                </div>
                              )}
                            </TableCell>

                            {/* 2. Fabric Used for this Item (Meters) */}
                            <TableCell className="p-2 w-[100px] min-w-[100px] text-center">
                              <Input
                                type="number"
                                min="0"
                                step="any"
                                placeholder={
                                  lines.length === 1 && qtyFabricUsed
                                    ? String(qtyFabricUsed)
                                    : "Meters"
                                }
                                value={line.qtyFabricUsed ?? ""}
                                onChange={(e) =>
                                  handleLineFieldChange(
                                    line.id,
                                    "qtyFabricUsed",
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-full min-w-[85px] px-2 text-xs tabular-nums text-center font-bold bg-background border-primary/40 focus:border-primary shadow-2xs"
                                title="Fabric meters consumed for this specific article"
                              />
                            </TableCell>

                            {/* 3. Per-Item Live CONS */}
                            <TableCell className="p-2 w-[90px] min-w-[90px] text-center">
                              {itemCost && itemCost.qtyTotalReceived > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 bg-primary/10 text-primary border-primary/20"
                                >
                                  {itemCost.consumption.toFixed(4)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">
                                  —
                                </span>
                              )}
                            </TableCell>

                            {/* 4. Total Pieces (A + B) */}
                            <TableCell className="p-2 w-[95px] min-w-[95px] text-center">
                              <Input
                                type="number"
                                min="1"
                                placeholder="Pcs"
                                value={line.qtyTotalReceived}
                                onChange={(e) =>
                                  handleLineFieldChange(
                                    line.id,
                                    "qtyTotalReceived",
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-full min-w-[80px] px-2 text-xs tabular-nums text-center font-bold bg-background shadow-2xs"
                                required
                              />
                            </TableCell>

                            {/* 5. B-Grade Defective Pieces */}
                            <TableCell className="p-2 w-[105px] min-w-[105px] text-center">
                              <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={line.qtyBGrade}
                                onChange={(e) =>
                                  handleLineFieldChange(
                                    line.id,
                                    "qtyBGrade",
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-full min-w-[80px] px-2 text-xs tabular-nums text-center font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 focus:border-amber-500 shadow-2xs"
                              />
                              {qTot > 0 && qB > 0 && (
                                <div className="mt-0.5 leading-none">
                                  <span
                                    className={`text-[10px] tabular-nums font-semibold ${
                                      qB / qTot > 0.3
                                        ? "text-destructive font-bold"
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {((qB / qTot) * 100).toFixed(0)}% Defect
                                  </span>
                                  {itemCost && (
                                    <span className="text-[10px] text-muted-foreground block font-mono">
                                      @ Rs {itemCost.bUnitValue.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* 6. A-Grade Sound Pieces (Auto calculated) */}
                            <TableCell className="p-2 w-[95px] min-w-[95px] text-center font-bold">
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 tabular-nums font-semibold text-xs px-2 py-0.5 whitespace-nowrap">
                                {qTot > 0 ? `${qA.toLocaleString()} pcs` : "—"}
                              </Badge>
                            </TableCell>

                            {/* 7. Vendor CMT Stitching Rate */}
                            <TableCell className="p-2 w-[100px] min-w-[100px] text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Rate"
                                value={line.cmtRate}
                                onChange={(e) =>
                                  handleLineFieldChange(
                                    line.id,
                                    "cmtRate",
                                    e.target.value,
                                  )
                                }
                                className="h-8 w-full min-w-[80px] px-2 text-xs tabular-nums text-right font-medium bg-background shadow-2xs"
                                required
                              />
                            </TableCell>

                            {/* 8. Initial Net Cost */}
                            <TableCell className="p-2 w-[105px] min-w-[105px] text-right">
                              {itemCost && itemCost.qtyTotalReceived > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className="tabular-nums font-semibold text-foreground text-xs">
                                    Rs {itemCost.initialNetCost.toFixed(2)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    Fab: Rs {itemCost.fabricCostPerPc.toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">—</span>
                              )}
                            </TableCell>

                            {/* 9. Live Row Recalculated Cost */}
                            <TableCell className="p-2 w-[125px] min-w-[125px] text-right">
                              {itemCost && itemCost.qtyAGrade > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 tabular-nums whitespace-nowrap">
                                    Rs{" "}
                                    {itemCost.aFinalUnitCost.toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      },
                                    )}
                                  </span>
                                  {qB > 0 && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums whitespace-nowrap">
                                      +Rs {(itemCost.aFinalUnitCost - itemCost.initialNetCost).toFixed(2)} absorbed
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">
                                  —
                                </span>
                              )}
                            </TableCell>

                            {/* 10. Total Line Bill */}
                            <TableCell className="p-2 w-[115px] min-w-[115px] text-right pr-3 font-semibold tabular-nums text-foreground">
                              {itemCost && itemCost.qtyTotalReceived > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-bold text-foreground">
                                    Rs{" "}
                                    {itemCost.totalBill.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    CMT: Rs {itemCost.vendorCmtBillAmount.toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">—</span>
                              )}
                            </TableCell>

                            {/* 11. Remove row */}
                            <TableCell className="p-2 w-[40px] min-w-[40px] text-center">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveLine(line.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Remove Line"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>

                    {/* ── Summary Totals Footer Row (Excel Matching) ── */}
                    {costing && (
                      <TableFooter className="bg-muted/40 font-semibold border-t-2 border-border text-xs">
                        <TableRow className="hover:bg-transparent">
                          {/* Col 1: Finished Article */}
                          <TableCell className="p-2 font-bold text-foreground whitespace-nowrap">
                            Batch Totals & Averages
                          </TableCell>

                          {/* Col 2: Fabric (m) */}
                          <TableCell className="p-2 text-center font-bold tabular-nums text-foreground whitespace-nowrap">
                            {costing.qtyFabricUsed.toLocaleString()} m
                          </TableCell>

                          {/* Col 3: CONS (m/pc) */}
                          <TableCell className="p-2 text-center tabular-nums whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className="text-[11px] font-semibold tabular-nums bg-primary/10 text-primary border-primary/30"
                            >
                              {costing.consumption.toFixed(4)} m/pc
                            </Badge>
                          </TableCell>

                          {/* Col 4: Total (A + B) */}
                          <TableCell className="p-2 text-center font-bold tabular-nums text-foreground whitespace-nowrap">
                            {costing.qtyTotalReceived.toLocaleString()} pcs
                          </TableCell>

                          {/* Col 5: Defect (B) */}
                          <TableCell className="p-2 text-center font-bold tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            <div>{costing.qtyBGrade.toLocaleString()} pcs</div>
                            {costing.qtyBGrade > 0 && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-normal">
                                -Rs {costing.bTotalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                            )}
                          </TableCell>

                          {/* Col 6: Sound (A) */}
                          <TableCell className="p-2 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {costing.qtyAGrade.toLocaleString()} pcs
                          </TableCell>

                          {/* Col 7: Vendor CMT */}
                          <TableCell className="p-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            Rs {costing.cmtCostPerPc.toFixed(2)}
                          </TableCell>

                          {/* Col 8: Initial Net */}
                          <TableCell className="p-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            Rs {costing.initialNetCost.toFixed(2)}
                          </TableCell>

                          {/* Col 9: Recalc A-Cost */}
                          <TableCell className="p-2 text-right whitespace-nowrap">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold tabular-nums text-xs">
                              Rs {costing.aFinalUnitCost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} / pc
                            </Badge>
                          </TableCell>

                          {/* Col 10: Total Line Bill */}
                          <TableCell className="p-2 text-right font-bold tabular-nums text-foreground whitespace-nowrap pr-3">
                            Rs {costing.totalBill.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>

                          {/* Col 11: Actions */}
                          <TableCell className="p-2 text-center"></TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>

                {/* Grid Footer Controls */}
                <div className="p-3 bg-muted/10 border-t flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2 max-w-xl">
                    <Checkbox
                      id="deductBGradeCmt"
                      checked={deductBGradeCmt}
                      onCheckedChange={(checked) =>
                        setDeductBGradeCmt(Boolean(checked))
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="deductBGradeCmt"
                        className="text-xs font-semibold cursor-pointer text-foreground flex items-center gap-1.5"
                      >
                        Exempt B-grade pieces from vendor CMT stitching bill
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        {deductBGradeCmt ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Vendor bill deducts B-defects: Billed only for{" "}
                            {batchTotals.totalA.toLocaleString()} Sound (A) pcs
                            × CMT
                          </span>
                        ) : (
                          <span>
                            Vendor bill pays for all{" "}
                            {batchTotals.totalRecv.toLocaleString()} received
                            pcs (Sound A + Defect B) × CMT
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-xs tabular-nums font-semibold">
                    <span>
                      Fabric:{" "}
                      <strong className="text-foreground">
                        {Number(qtyFabricUsed || 0).toLocaleString()} m
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total Pieces:{" "}
                      <strong className="text-foreground">
                        {batchTotals.totalRecv.toLocaleString()}
                      </strong>
                    </span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Sound (A):{" "}
                      <strong>{batchTotals.totalA.toLocaleString()}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      Defective (B):{" "}
                      <strong>{batchTotals.totalB.toLocaleString()}</strong>
                    </span>
                    {costing && (
                      <>
                        <span>•</span>
                        <span className="text-primary font-bold">
                          Avg CONS:{" "}
                          <strong>{costing.consumption.toFixed(4)} m/pc</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* ── Financial Summary Cards (Below Stage 2 Table) ── */}
                {costing && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-muted/20 border-t border-border">
                    <div className="p-3 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calculator className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Total Production Gross Value
                      </span>
                      <div className="text-lg font-bold text-foreground tabular-nums">
                        Rs {costing.totalBill.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400">
                        Includes 50% B-loss (- Rs {costing.bTotalValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}) absorbed into sound stock
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/30 shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-900 dark:text-blue-200">
                        <span className="flex items-center gap-1.5">
                          <FileCheck2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Auto CMT Purchase Invoice
                        </span>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-300 text-[10px] py-0 font-medium">
                          Status: SUBMITTED
                        </Badge>
                      </div>
                      <div className="text-lg font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                        Rs {costing.vendorCmtBillAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                        Billed to vendor for {costing.deductBGradeCmt ? costing.qtyAGrade : costing.qtyTotalReceived} pcs stitching labor (Fabric excluded)
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Stage 3: Warehouse Stock Routing ── */}
            <Card className="border border-border/80 shadow-2xs">
              <CardHeader className="py-3 px-4 border-b bg-muted/15">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  Stage 3: Warehouse Stock Routing & Reference
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      A-Grade Stock Warehouse (Sound Stock){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={aGradeWarehouseId}
                      onValueChange={setAGradeWarehouseId}
                      required
                    >
                      <SelectTrigger className="w-full text-xs h-9 bg-background">
                        <SelectValue placeholder="Select Finished Goods Warehouse..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem
                            key={w.id}
                            value={w.id}
                            className="text-xs"
                          >
                            [{w.code}] {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-foreground">
                        B-Grade Warehouse (Defective Stock){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 font-medium">
                        Dedicated B-Stock
                      </Badge>
                    </div>
                    <Select
                      value={bGradeWarehouseId}
                      onValueChange={setBGradeWarehouseId}
                      required
                    >
                      <SelectTrigger className="w-full text-xs h-9 bg-background">
                        <SelectValue placeholder="Select B-Grade Warehouse..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem
                            key={w.id}
                            value={w.id}
                            className="text-xs"
                          >
                            [{w.code}] {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      Production Receiving Date
                    </Label>
                    <Input
                      type="date"
                      value={productionDate}
                      onChange={(e) => setProductionDate(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">
                      Batch Reference / Quality Notes
                    </Label>
                    <Input
                      placeholder="e.g. Lot #1 - Washing Batch 14"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>General Ledger Integration:</strong> On submission, stock will immediately be routed to A-Grade and B-Grade warehouses, and CMT Purchase Invoice will be generated in <code>SUBMITTED</code> status. When Accounts approves it, a Journal Voucher (JV) posts to the General Ledger.
                  </span>
                </div>
              </CardContent>
            </Card>
      </form>

      {/* ── Modal Bottom Action Bar ── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-t bg-muted/20 shrink-0">
        <div className="text-xs tabular-nums text-muted-foreground">
          {batchTotals.hasValidLine ? (
            <span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {batchTotals.totalA.toLocaleString()} A-pcs
              </strong>{" "}
              (
              <span className="text-amber-600 dark:text-amber-400">
                {batchTotals.totalB.toLocaleString()} B-pcs
              </span>
              ) • Total CMT Bill:{" "}
              <strong className="text-foreground">
                Rs{" "}
                {(costing?.vendorCmtBillAmount || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
          ) : (
            <span>Awaiting finished goods receiving quantities...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !batchTotals.hasValidLine}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Posting Batch & Generating Invoice...
              </span>
            ) : (
              "Submit Production & Generate Invoice"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
