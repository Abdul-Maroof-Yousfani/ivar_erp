'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { warehouseApi, inventoryApi, locationApi, brandApi, categoryApi, silhouetteApi, genderApi, Warehouse, WarehouseLocation } from '@/lib/api';
import { createTransferRequest, createReturnTransferRequest, createOutletToOutletTransferRequest, getTransferRequests, acceptTransferRequest } from '@/lib/actions/transfer-request';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRightLeft, Search, Package, Save, History, RotateCcw, Trash2, Plus, CheckCircle2, Info, Loader2, WarehouseIcon, ArrowDown, Filter, X, ChevronDown, ChevronRight, ScanBarcode, Volume2, VolumeX, Keyboard, Sparkles, Upload, PackageCheck, Scan, Barcode } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Autocomplete, AutocompleteOption } from '@/components/ui/autocomplete';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { TransferBulkUploadModal } from '@/components/inventory/transfer-bulk-upload-modal';
import { useAuth } from '@/components/providers/auth-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export default function StockTransferPage() {
    const router = useRouter();
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [locations, setLocations] = useState<WarehouseLocation[]>([]);
    const [masterLocations, setMasterLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Bulk upload & draft persistence state
    const STORAGE_KEY = "active_transfer_upload_id";
    const DRAFT_STORAGE_KEY = "stock_transfer_items_draft";
    const isInitializedRef = useRef(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

    // Restore persisted upload ID on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setActiveUploadId(stored);
    }, []);

    const clearDraft = () => {
        setSelectedItems([]);
        setGlobalNotes('');
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch (e) {}
        toast.info('Draft cleared.');
    };

    const changeTransferMode = (newMode: 'WAREHOUSE_TO_OUTLET' | 'OUTLET_TO_WAREHOUSE' | 'OUTLET_TO_OUTLET' | 'WAREHOUSE_RECEIVING') => {
        if (newMode === transferMode) return;
        if (selectedItems.length > 0) {
            const confirmSwitch = window.confirm("Switching transfer mode will clear your current transfer items. Are you sure?");
            if (!confirmSwitch) return;
        }
        setTransferMode(newMode);
        setSelectedItems([]);
    };

    const handleUploadIdChange = (id: string | null) => {
        setActiveUploadId(id);
        if (id) {
            localStorage.setItem(STORAGE_KEY, id);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    };

    const handleBulkUploadSuccess = (resolvedItems: any[]) => {
        if (resolvedItems.length === 0) return;

        let warningTriggered = false;

        setSelectedItems(prev => {
            const updated = [...prev];
            let addedCount = 0;
            let incrementedCount = 0;

            for (const newItem of resolvedItems) {
                const existingIndex = updated.findIndex(i => i.id === newItem.id);
                const newQty = existingIndex > -1 ? updated[existingIndex].quantity + newItem.quantity : newItem.quantity;

                if (newQty > newItem.availableStock && transferMode !== 'WAREHOUSE_TO_OUTLET') {
                    warningTriggered = true;
                }

                if (existingIndex > -1) {
                    updated[existingIndex].quantity = newQty;
                    incrementedCount++;
                } else {
                    updated.push({
                        id: newItem.id,
                        sku: newItem.sku,
                        description: newItem.description,
                        color: newItem.color,
                        size: newItem.size,
                        quantity: newItem.quantity,
                        notes: '',
                        availableStock: newItem.availableStock,
                    });
                    addedCount++;
                }
            }

            toast.success(`Successfully loaded bulk items: ${addedCount} added, ${incrementedCount} incremented.`);
            if (warningTriggered) {
                toast.warning("One or more imported items exceed available stock at source.");
            }
            return updated;
        });

        handleUploadIdChange(null);
    };

    const { user } = useAuth();

    // Form State
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
    const [sourceLocationId, setSourceLocationId] = useState<string>('unassigned');
    const [destLocationId, setDestLocationId] = useState<string>('');
    const [transferMode, setTransferMode] = useState<'WAREHOUSE_TO_OUTLET' | 'OUTLET_TO_WAREHOUSE' | 'OUTLET_TO_OUTLET' | 'WAREHOUSE_RECEIVING'>('WAREHOUSE_TO_OUTLET');

    // Warehouse Receiving Mode State
    const [incomingWarehouseRequests, setIncomingWarehouseRequests] = useState<any[]>([]);
    const [loadingIncoming, setLoadingIncoming] = useState(false);
    const [inspectingRequest, setInspectingRequest] = useState<any | null>(null);
    const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});
    const [receivingNotes, setReceivingNotes] = useState<string>('');
    const [isAccepting, setIsAccepting] = useState<string | null>(null);

    // Scanner state for receiving modal
    const [modalScanInput, setModalScanInput] = useState<string>('');
    const modalScannerRef = useRef<HTMLInputElement>(null);
    const [lastScannedModalItemId, setLastScannedModalItemId] = useState<string | null>(null);

    const fetchIncomingWarehouseTransfers = async () => {
        setLoadingIncoming(true);
        try {
            const res = await getTransferRequests({ 
                warehouseId: selectedWarehouseId && selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
                status: 'PENDING',
                transferType: 'OUTLET_TO_WAREHOUSE'
            });
            if (res && res.status) {
                setIncomingWarehouseRequests(res.data || []);
            } else if (Array.isArray(res)) {
                setIncomingWarehouseRequests(res);
            } else {
                setIncomingWarehouseRequests([]);
            }
        } catch (error) {
            console.error('Failed to load incoming warehouse transfers', error);
        } finally {
            setLoadingIncoming(false);
        }
    };

    useEffect(() => {
        if (transferMode === 'WAREHOUSE_RECEIVING' || selectedWarehouseId) {
            fetchIncomingWarehouseTransfers();
        }
    }, [transferMode, selectedWarehouseId]);

    const openWarehouseInspectModal = (request: any) => {
        const initialMap: Record<string, number> = {};
        request.items?.forEach((item: any) => {
            initialMap[item.itemId] = Number(item.quantity || 0);
        });
        setReceivedQtyMap(initialMap);
        setReceivingNotes('');
        setModalScanInput('');
        setLastScannedModalItemId(null);
        setInspectingRequest(request);
    };

    const handleAcceptWarehouseInspected = async () => {
        if (!inspectingRequest) return;

        const receivedItems = inspectingRequest.items.map((item: any) => ({
            itemId: item.itemId,
            receivedQty: receivedQtyMap[item.itemId] !== undefined ? Number(receivedQtyMap[item.itemId]) : Number(item.quantity || 0),
        }));

        setIsAccepting(inspectingRequest.id);
        try {
            const res = await acceptTransferRequest(inspectingRequest.id, user?.id, receivedItems, receivingNotes);
            if (res && res.status) {
                toast.success("Stock received into warehouse successfully!");
                setIncomingWarehouseRequests(prev => prev.filter(r => r.id !== inspectingRequest.id));
                setInspectingRequest(null);
                loadWarehouses();
            } else {
                toast.error(res?.message || "Failed to accept stock");
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to accept stock");
        } finally {
            setIsAccepting(null);
        }
    };

    const handleModalScanBarcode = (barcodeVal: string) => {
        const code = barcodeVal.trim().toLowerCase();
        if (!code || !inspectingRequest) return;

        const matchedItem = inspectingRequest.items?.find((i: any) => {
            const sku = i.item?.sku?.toLowerCase();
            const barcode = (i.item?.barcode || i.item?.barCode)?.toLowerCase();
            const itemCode = i.item?.code?.toLowerCase();
            const itemId = i.itemId?.toLowerCase();
            const upc = i.item?.upc?.toLowerCase();
            const ean = i.item?.ean?.toLowerCase();

            return (
                sku === code ||
                barcode === code ||
                itemCode === code ||
                itemId === code ||
                upc === code ||
                ean === code ||
                (sku && code.includes(sku))
            );
        });

        if (matchedItem) {
            if (soundEnabled) playScanSuccessBeep();
            const currentRx = receivedQtyMap[matchedItem.itemId] !== undefined 
                ? Number(receivedQtyMap[matchedItem.itemId]) 
                : Number(matchedItem.quantity || 0);
            const newRx = currentRx + 1;
            
            setReceivedQtyMap(prev => ({
                ...prev,
                [matchedItem.itemId]: newRx
            }));
            setLastScannedModalItemId(matchedItem.itemId);
            toast.success(`+1 Scanned: ${matchedItem.item?.description || matchedItem.item?.sku || "Item"} (Total Rx: ${newRx})`);
        } else {
            if (soundEnabled) playScanErrorBuzz();
            toast.error(`Barcode/SKU "${barcodeVal}" not found in this transfer shipment.`);
        }

        setModalScanInput("");
    };

    useEffect(() => {
        if (inspectingRequest) {
            const timer = setTimeout(() => {
                modalScannerRef.current?.focus();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [inspectingRequest]);

    // Item Selection State
    const [selectedItems, setSelectedItems] = useState<Array<{
        id: string;
        sku: string;
        description: string;
        color?: string;
        size?: string;
        quantity: number;
        notes: string;
        availableStock: number;
    }>>([]);
    const [itemOptions, setItemOptions] = useState<AutocompleteOption[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [globalNotes, setGlobalNotes] = useState('');

    // Selection State
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [bulkQty, setBulkQty] = useState<number>(1);
    const [searchQuery, setSearchQuery] = useState('');

    // Barcode scanner states
    const [barcodeTab, setBarcodeTab] = useState<'scan' | 'search'>('scan');
    const [globalScannerActive, setGlobalScannerActive] = useState(true);
    const [autoIncrement, setAutoIncrement] = useState(true);
    const [lastScannedItem, setLastScannedItem] = useState<{ sku: string; description: string; timestamp: string } | null>(null);
    const [scanning, setScanning] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [scannerInput, setScannerInput] = useState('');

    const scannerInputRef = useRef<HTMLInputElement>(null);

    // Filter State
    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [silhouettes, setSilhouettes] = useState<any[]>([]);
    const [genders, setGenders] = useState<any[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [pendingBrandIds, setPendingBrandIds] = useState<string[]>([]);
    const [pendingCategoryIds, setPendingCategoryIds] = useState<string[]>([]);
    const [pendingSilhouetteIds, setPendingSilhouetteIds] = useState<string[]>([]);
    const [pendingGenderIds, setPendingGenderIds] = useState<string[]>([]);
    const [appliedFilters, setAppliedFilters] = useState<{
        brandIds: string[]; categoryIds: string[]; silhouetteIds: string[]; genderIds: string[];
    }>({ brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] });
    const activeFilterCount = appliedFilters.brandIds.length + appliedFilters.categoryIds.length + appliedFilters.silhouetteIds.length + appliedFilters.genderIds.length;

    // Filter sheet search + section collapse
    const [filterSearch, setFilterSearch] = useState('');
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const toggleSection = (key: string) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));

    // Web Audio API Synthesized Audio Cues
    const playScanSuccessBeep = () => {
        if (typeof window === 'undefined') return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1050, audioCtx.currentTime); // Crisp, positive beep
            gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        } catch (e) {
            console.warn('Audio Context failed:', e);
        }
    };

    const playScanErrorBuzz = () => {
        if (typeof window === 'undefined') return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            osc1.connect(gainNode);
            osc2.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            osc1.type = 'sawtooth';
            osc2.type = 'sawtooth';
            osc1.frequency.setValueAtTime(140, audioCtx.currentTime); // Bass/buzz mismatch sound
            osc2.frequency.setValueAtTime(143, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
            
            osc1.start();
            osc2.start();
            osc1.stop(audioCtx.currentTime + 0.22);
            osc2.stop(audioCtx.currentTime + 0.22);
        } catch (e) {
            console.warn('Audio Context failed:', e);
        }
    };

    // Focus scanner helper
    const focusScannerInput = () => {
        if (scannerInputRef.current) {
            scannerInputRef.current.focus();
        }
    };

    // Auto-focus on mount and tab switch
    useEffect(() => {
        if (barcodeTab === 'scan') {
            const timer = setTimeout(() => {
                focusScannerInput();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [barcodeTab]);

    // Shortcut key: F2 to focus scanner input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault();
                setBarcodeTab('scan');
                setTimeout(focusScannerInput, 50);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Barcode Resolution handler
    const handleBarcodeResolve = async (barcode: string) => {
        if (!barcode.trim()) return;
        if (!selectedWarehouseId) {
            if (soundEnabled) playScanErrorBuzz();
            toast.error('Please select a warehouse first.');
            return;
        }
        setScanning(true);
        try {
            let searchLocationId = undefined;
            if (transferMode !== 'WAREHOUSE_TO_OUTLET') {
                const sourceLocId = transferMode === 'OUTLET_TO_WAREHOUSE' ? destLocationId : sourceLocationId;
                if (sourceLocId && sourceLocId !== 'unassigned') {
                    searchLocationId = sourceLocId;
                }
            }

            const res = await inventoryApi.search(barcode.trim(), selectedWarehouseId, searchLocationId, appliedFilters);
            if (!res.status || !res.data || res.data.length === 0) {
                if (soundEnabled) playScanErrorBuzz();
                toast.error(`No item found for barcode/SKU: "${barcode}"`);
                return;
            }

            const cleanedBarcode = barcode.trim().toLowerCase();
            let matchedItem = res.data.find((item: any) => 
                (item.barCode && item.barCode.toLowerCase() === cleanedBarcode) ||
                (item.sku && item.sku.toLowerCase() === cleanedBarcode) ||
                (item.itemId && item.itemId.toLowerCase() === cleanedBarcode)
            );

            if (!matchedItem && res.data.length === 1) {
                matchedItem = res.data[0];
            } else if (!matchedItem && res.data.length > 1) {
                if (soundEnabled) playScanErrorBuzz();
                toast.warning(`Multiple items found for "${barcode}". Please use manual search.`);
                return;
            }

            if (!matchedItem) {
                if (soundEnabled) playScanErrorBuzz();
                toast.error(`No item found for barcode/SKU: "${barcode}"`);
                return;
            }

            let availableStock = typeof matchedItem.totalQuantity === 'number' ? matchedItem.totalQuantity : 0;

            const itemData = {
                id: matchedItem.id,
                sku: matchedItem.sku ?? matchedItem.itemId ?? '',
                description: matchedItem.description ?? matchedItem.name ?? '',
                color: matchedItem.color?.name,
                size: matchedItem.size?.name,
                availableStock: availableStock,
            };

            const existingIndex = selectedItems.findIndex(i => i.id === itemData.id);
            if (existingIndex > -1) {
                if (autoIncrement) {
                    const newQty = selectedItems[existingIndex].quantity + bulkQty;
                    if (newQty > itemData.availableStock && transferMode !== 'WAREHOUSE_TO_OUTLET') {
                        toast.warning(`Quantity exceeds available stock (${itemData.availableStock})`);
                    }
                    setSelectedItems(prev => prev.map((item, idx) => 
                        idx === existingIndex 
                            ? { ...item, quantity: item.quantity + bulkQty }
                            : item
                    ));
                    if (soundEnabled) playScanSuccessBeep();
                    toast.success(`Incremented quantity for ${itemData.sku} (Total: ${newQty})`, {
                        id: `scan-inc-${itemData.id}`,
                    });
                } else {
                    if (soundEnabled) playScanErrorBuzz();
                    toast.info(`Item ${itemData.sku} is already added.`, {
                        id: `scan-dup-${itemData.id}`,
                    });
                }
            } else {
                if (bulkQty > itemData.availableStock && transferMode !== 'WAREHOUSE_TO_OUTLET') {
                    toast.warning(`Quantity exceeds available stock (${itemData.availableStock})`);
                }
                setSelectedItems(prev => [...prev, {
                    id: itemData.id,
                    sku: itemData.sku,
                    description: itemData.description,
                    color: itemData.color,
                    size: itemData.size,
                    quantity: bulkQty,
                    notes: '',
                    availableStock: itemData.availableStock,
                }]);
                if (soundEnabled) playScanSuccessBeep();
                toast.success(`Added ${itemData.sku} to transfer list.`, {
                    id: `scan-add-${itemData.id}`,
                });
            }

            setLastScannedItem({
                sku: itemData.sku,
                description: itemData.description,
                timestamp: new Date().toLocaleTimeString(),
            });

        } catch (error) {
            if (soundEnabled) playScanErrorBuzz();
            toast.error('Failed to resolve scanned item');
        } finally {
            setScanning(false);
        }
    };

    // Global Scanner Keyboard Input Interceptor
    useEffect(() => {
        if (!globalScannerActive) return;

        let buffer = '';
        let lastKeyTime = Date.now();

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (activeEl) {
                const tag = activeEl.tagName.toLowerCase();
                const type = (activeEl as HTMLInputElement).type?.toLowerCase();

                if (activeEl.id === 'barcode-scanner-input') {
                    return;
                }

                if (
                    tag === 'textarea' ||
                    (tag === 'input' && (type === 'text' || type === 'number' || type === 'search' || type === 'date')) ||
                    activeEl.getAttribute('role') === 'combobox' ||
                    activeEl.classList.contains('autofocus-ignore')
                ) {
                    return;
                }
            }

            const now = Date.now();
            
            if (now - lastKeyTime > 80 && buffer.length > 0) {
                buffer = '';
            }

            lastKeyTime = now;

            if (e.key === 'Enter') {
                if (buffer.length >= 3) {
                    e.preventDefault();
                    const barcode = buffer;
                    buffer = '';
                    handleBarcodeResolve(barcode);
                } else {
                    buffer = '';
                }
            } else if (e.key.length === 1) {
                buffer += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [globalScannerActive, selectedItems, autoIncrement, bulkQty, soundEnabled, selectedWarehouseId, transferMode, destLocationId, sourceLocationId, appliedFilters]);

    // Initialize & restore draft
    useEffect(() => {
        const initialize = async () => {
            await loadWarehouses();
            await loadMasterLocations();
            await loadFilterData();

            try {
                const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    if (parsed && Array.isArray(parsed.selectedItems) && parsed.selectedItems.length > 0) {
                        if (parsed.transferMode) setTransferMode(parsed.transferMode);
                        if (parsed.selectedWarehouseId) {
                            setSelectedWarehouseId(parsed.selectedWarehouseId);
                            await loadLocations(parsed.selectedWarehouseId);
                        }
                        if (parsed.sourceLocationId) setSourceLocationId(parsed.sourceLocationId);
                        if (parsed.destLocationId) setDestLocationId(parsed.destLocationId);
                        if (parsed.globalNotes !== undefined) setGlobalNotes(parsed.globalNotes);
                        setSelectedItems(parsed.selectedItems);
                        toast.info(`Restored ${parsed.selectedItems.length} draft item(s) from previous session.`);
                    }
                }
            } catch (err) {
                console.error('Failed to load draft from localStorage', err);
            } finally {
                isInitializedRef.current = true;
            }
        };

        initialize();
    }, []);

    // Auto-save draft to localStorage whenever relevant states update
    useEffect(() => {
        if (!isInitializedRef.current) return;

        try {
            if (selectedItems.length > 0 || globalNotes.trim()) {
                const draftData = {
                    transferMode,
                    selectedWarehouseId,
                    sourceLocationId,
                    destLocationId,
                    globalNotes,
                    selectedItems,
                    updatedAt: new Date().toISOString(),
                };
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
            } else {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            }
        } catch (e) {
            console.error('Failed to save draft to localStorage', e);
        }
    }, [selectedItems, transferMode, selectedWarehouseId, sourceLocationId, destLocationId, globalNotes]);

    const loadMasterLocations = async () => {
        try {
            const res = await locationApi.getAll();
            if (res.status) {
                setMasterLocations(res.data);
            }
        } catch (error) {
            console.error('Failed to load master locations', error);
        }
    };

    const loadFilterData = async () => {
        try {
            const [brandsRes, catsRes, silsRes, gensRes] = await Promise.allSettled([
                brandApi.getAll(),
                categoryApi.getAll(),
                silhouetteApi.getAll(),
                genderApi.getAll(),
            ]);
            if (brandsRes.status === 'fulfilled' && brandsRes.value.status) setBrands(brandsRes.value.data);
            if (catsRes.status === 'fulfilled' && catsRes.value.status) setCategories(catsRes.value.data);
            if (silsRes.status === 'fulfilled' && silsRes.value.status) setSilhouettes(silsRes.value.data);
            if (gensRes.status === 'fulfilled' && gensRes.value.status) setGenders(gensRes.value.data);
        } catch (error) {
            console.error('Failed to load filter data', error);
        }
    };

    const loadWarehouses = async () => {
        try {
            const data = await warehouseApi.getAll();
            setWarehouses(data);
            if (data.length > 0) {
                setSelectedWarehouseId(data[0].id);
                await loadLocations(data[0].id);
            }
            return data;
        } catch (error) {
            toast.error('Failed to load warehouses');
            return [];
        } finally {
            setLoading(false);
        }
    };

    const loadLocations = async (whId: string) => {
        try {
            const wh = await warehouseApi.getById(whId);
            const locs = wh.locations || [];
            const sortedLocs = [...locs].sort((a, b) => (a.type === 'MAIN' ? -1 : 1));
            setLocations(sortedLocs);

            const mainLoc = sortedLocs.find(l => l.type === 'MAIN');
            const shopLocs = sortedLocs.filter(l => l.type === 'SHOP');

            if (mainLoc) setSourceLocationId(mainLoc.id);
            if (shopLocs.length > 0) {
                const firstShop = shopLocs.find(l => l.id !== mainLoc?.id) || shopLocs[0];
                setDestLocationId(firstShop.id);
            }
        } catch (error) {
            toast.error('Failed to load locations');
        }
    };

    const handleItemSearch = async (query: string, overrideFilters?: typeof appliedFilters) => {
        setSearchQuery(query);
        const activeFilters = overrideFilters ?? appliedFilters;
        const hasFilters = activeFilters.brandIds.length > 0 || activeFilters.categoryIds.length > 0 || activeFilters.silhouetteIds.length > 0 || activeFilters.genderIds.length > 0;
        if ((!query || query.length < 2) && !hasFilters || !selectedWarehouseId) {
            if (!hasFilters) { setItemOptions([]); return; }
        }
        setSearchLoading(true);
        try {
            let searchLocationId = undefined;
            if (transferMode !== 'WAREHOUSE_TO_OUTLET') {
                const sourceLocId = transferMode === 'OUTLET_TO_WAREHOUSE' ? destLocationId : sourceLocationId;
                if (sourceLocId && sourceLocId !== 'unassigned') {
                    searchLocationId = sourceLocId;
                }
            }

            const res = await inventoryApi.search(query, selectedWarehouseId, searchLocationId, activeFilters);
            if (res.status && res.data) {
                const options = res.data.map((item: any) => {
                    let totalQty = typeof item.totalQuantity === 'number' ? item.totalQuantity : 0;

                    return {
                        value: item.id,
                        label: `${item.sku} - ${item.description}`,
                        description: `Available: ${totalQty}`,
                        item: { ...item, availableStock: totalQty }
                    };
                });

                setItemOptions(options);
                if (!isPopoverOpen) setIsPopoverOpen(true);
            }
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const toggleItemSelection = (itemData: any) => {
        const isSelected = selectedItems.find(i => i.id === itemData.id);

        if (isSelected) {
            setSelectedItems(prev => prev.filter(i => i.id !== itemData.id));
        } else {
            if (bulkQty <= 0) {
                toast.error('Quantity must be greater than 0');
                return;
            }

            if (bulkQty > itemData.availableStock && transferMode !== 'WAREHOUSE_TO_OUTLET') {
                toast.warning(`Quantity exceeds available stock (${itemData.availableStock})`);
            }

            setSelectedItems(prev => [...prev, {
                id: itemData.id,
                sku: itemData.sku,
                description: itemData.description,
                color: itemData.color?.name,
                size: itemData.size?.name,
                quantity: bulkQty,
                notes: '',
                availableStock: itemData.availableStock
            }]);
        }
    };

    const updateItemQuantity = (id: string, qty: number) => {
        setSelectedItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity: qty } : item
        ));
    };

    const updateItemNotes = (id: string, notes: string) => {
        setSelectedItems(prev => prev.map(item =>
            item.id === id ? { ...item, notes } : item
        ));
    };

    const removeItem = (id: string) => {
        setSelectedItems(prev => prev.filter(item => item.id !== id));
    };

    const handleTransfer = async () => {
        if (selectedItems.length === 0 || !selectedWarehouseId || !destLocationId) {
            toast.error('Please complete all fields and select at least one item');
            return;
        }

        if (transferMode === 'OUTLET_TO_OUTLET' && (!sourceLocationId || sourceLocationId === 'unassigned')) {
            toast.error('Please select source outlet');
            return;
        }

        const hasInvalidQty = selectedItems.some(item => item.quantity <= 0);
        if (hasInvalidQty) {
            toast.error('All items must have a quantity greater than 0');
            return;
        }

        const hasInsufficientStock = selectedItems.some(item => item.quantity > item.availableStock);
        if (hasInsufficientStock && transferMode !== 'WAREHOUSE_TO_OUTLET') {
            toast.error('One or more items have insufficient stock for this transfer');
            return;
        }

        setSubmitting(true);
        try {
            const itemsToTransfer = selectedItems.map(item => ({
                itemId: item.id,
                quantity: item.quantity,
                notes: item.notes
            }));

            if (transferMode === 'WAREHOUSE_TO_OUTLET') {
                const res = await createTransferRequest({
                    fromWarehouseId: selectedWarehouseId,
                    toLocationId: destLocationId,
                    items: itemsToTransfer,
                    notes: globalNotes
                });
                if (!res || !res.status) {
                    toast.error(res?.message || 'Failed to create transfer request');
                    setSubmitting(false);
                    return;
                }
                toast.success('Transfer request created! Awaiting shop acceptance.');
            } else if (transferMode === 'OUTLET_TO_WAREHOUSE') {
                const res = await createReturnTransferRequest({
                    fromLocationId: destLocationId,
                    fromWarehouseId: selectedWarehouseId,
                    items: itemsToTransfer,
                    notes: globalNotes
                });
                if (!res || !res.status) {
                    toast.error(res?.message || 'Failed to create return request');
                    setSubmitting(false);
                    return;
                }
                toast.success('Return request created! Awaiting outlet manager approval.');
            } else if (transferMode === 'OUTLET_TO_OUTLET') {
                const res = await createOutletToOutletTransferRequest({
                    fromLocationId: sourceLocationId,
                    toLocationId: destLocationId,
                    items: itemsToTransfer,
                    notes: globalNotes
                });
                if (!res || !res.status) {
                    toast.error(res?.message || 'Failed to create outlet transfer request');
                    setSubmitting(false);
                    return;
                }
                toast.success('Outlet transfer request created! Awaiting dual approval.');
            }

            setSelectedItems([]);
            setGlobalNotes('');
            try {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            } catch (e) {}
        } catch (error: any) {
            toast.error(error.message || 'Transfer failed');
        } finally {
            setSubmitting(false);
        }
    };

    const warehouseOptions = warehouses.map(w => ({ value: w.id, label: w.name }));
    const locationOptions = masterLocations.map(l => ({
        value: l.id,
        label: l.code ? `${l.code} · ${l.name}` : l.name,
    }));

    return (
        <PermissionGuard permissions="erp.inventory.transfer.create">
            <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {transferMode === 'WAREHOUSE_TO_OUTLET' ? 'Stock Transfer' :
                                transferMode === 'OUTLET_TO_WAREHOUSE' ? 'Return Transfer' :
                                transferMode === 'OUTLET_TO_OUTLET' ? 'Outlet Transfer' : 'Receive Warehouse Stock'}
                        </h1>
                        <p className="text-muted-foreground">
                            {transferMode === 'WAREHOUSE_TO_OUTLET'
                                ? 'Move stock from warehouse to outlets.'
                                : transferMode === 'OUTLET_TO_WAREHOUSE'
                                    ? 'Return stock from outlets to warehouse.'
                                    : transferMode === 'OUTLET_TO_OUTLET'
                                        ? 'Transfer stock between outlets with dual approval.'
                                        : 'Inspect and receive incoming stock returns at warehouse.'
                            }
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={transferMode === 'WAREHOUSE_TO_OUTLET' ? 'default' : 'outline'}
                                onClick={() => changeTransferMode('WAREHOUSE_TO_OUTLET')}
                                className="font-bold"
                            >
                                <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Out
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Move stock from warehouse to an outlet</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={transferMode === 'OUTLET_TO_WAREHOUSE' ? 'default' : 'outline'}
                                onClick={() => changeTransferMode('OUTLET_TO_WAREHOUSE')}
                                className="font-bold"
                            >
                                <RotateCcw className="h-4 w-4 mr-2" /> Return
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Return stock from an outlet back to warehouse</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={transferMode === 'OUTLET_TO_OUTLET' ? 'default' : 'outline'}
                                onClick={() => changeTransferMode('OUTLET_TO_OUTLET')}
                                className="font-bold"
                            >
                                <ArrowRightLeft className="h-4 w-4 mr-2" /> Outlet Transfer
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Transfer stock between two outlets (requires dual approval)</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={transferMode === 'WAREHOUSE_RECEIVING' ? 'default' : 'outline'}
                                onClick={() => changeTransferMode('WAREHOUSE_RECEIVING')}
                                className={`font-bold border-2 ${transferMode === 'WAREHOUSE_RECEIVING' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                            >
                                <PackageCheck className="h-4 w-4 mr-2" /> Receive Stock
                                {incomingWarehouseRequests.length > 0 && (
                                    <Badge variant="secondary" className="ml-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold px-1.5 py-0.2 text-[10px]">
                                        {incomingWarehouseRequests.length}
                                    </Badge>
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Inspect and receive incoming stock returns/transfers into warehouse</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                onClick={() => setIsUploadModalOpen(true)}
                                className="border-2 font-bold shadow-sm border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                                disabled={
                                    transferMode === 'WAREHOUSE_TO_OUTLET'
                                        ? !selectedWarehouseId
                                        : transferMode === 'OUTLET_TO_WAREHOUSE'
                                        ? !destLocationId
                                        : !sourceLocationId
                                }
                            >
                                <Upload className="h-4 w-4 mr-2" /> Bulk Upload
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {transferMode === 'WAREHOUSE_TO_OUTLET'
                                ? (selectedWarehouseId ? "Bulk upload items from CSV/Excel" : "Select warehouse first")
                                : transferMode === 'OUTLET_TO_WAREHOUSE'
                                ? (destLocationId ? "Bulk upload items from CSV/Excel" : "Select source outlet first")
                                : (sourceLocationId ? "Bulk upload items from CSV/Excel" : "Select source outlet first")
                            }
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" asChild className="border-2 font-bold shadow-sm">
                                <Link href="/erp/inventory/transactions/stock-transfer/history" transitionTypes={["nav-forward"]}>
                                    <History className="h-4 w-4 mr-2" /> History
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>View all past transfer requests</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {transferMode === 'WAREHOUSE_RECEIVING' ? (
                <Card className="border-emerald-500/20 shadow-sm">
                    <CardHeader className="border-b bg-emerald-500/5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <CardTitle className="text-xl font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                                <PackageCheck className="h-6 w-6 text-emerald-600" />
                                Incoming Warehouse Shipments & Shop Returns
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Inspect and receive stock transfers returning from outlets to the warehouse.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-60">
                                <Autocomplete
                                    options={warehouseOptions}
                                    value={selectedWarehouseId}
                                    onValueChange={(val) => {
                                        setSelectedWarehouseId(val);
                                    }}
                                    placeholder="Select Warehouse..."
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchIncomingWarehouseTransfers} disabled={loadingIncoming} className="h-9 gap-1.5 font-semibold shrink-0">
                                <Loader2 className={`h-4 w-4 ${loadingIncoming ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        {loadingIncoming ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                                <p className="text-sm font-medium">Loading incoming shipments for warehouse...</p>
                            </div>
                        ) : incomingWarehouseRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
                                <h3 className="text-lg font-bold text-foreground">No Pending Incoming Transfers</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                    There are currently no return requests or incoming stock shipments waiting to be received at this warehouse.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {incomingWarehouseRequests.map((req: any) => {
                                    const totalQty = req.items?.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0) || 0;
                                    const fromName = req.fromLocation?.name || req.fromLocationId || "Outlet Store";
                                    const toWhName = req.fromWarehouse?.name || "Main Warehouse";

                                    return (
                                        <Card key={req.id} className="border-border/60 hover:border-emerald-500/40 transition-colors shadow-xs">
                                            <CardContent className="p-5 space-y-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono font-bold text-sm text-primary">{req.requestNo}</span>
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                                                                {req.status}
                                                            </Badge>
                                                            <Badge variant="secondary" className="text-[10px] font-semibold">
                                                                {req.transferType === 'OUTLET_TO_WAREHOUSE' ? 'Return to Warehouse' : 'Stock Transfer'}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-medium">
                                                            From: <span className="font-bold text-foreground">{fromName}</span> → Target: <span className="font-bold text-foreground">{toWhName}</span>
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5">
                                                            Sent: {new Date(req.createdAt).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="font-bold text-xs bg-muted px-2.5 py-1">
                                                        {totalQty} Units
                                                    </Badge>
                                                </div>

                                                {/* Item Summary Table */}
                                                <div className="border rounded-md overflow-hidden bg-muted/20 text-xs">
                                                    <div className="bg-muted/50 px-3 py-1.5 font-bold uppercase text-[10px] text-muted-foreground grid grid-cols-12 gap-2">
                                                        <span className="col-span-8">Item Description</span>
                                                        <span className="col-span-4 text-right">Dispatched</span>
                                                    </div>
                                                    <div className="divide-y max-h-28 overflow-y-auto">
                                                        {req.items?.map((it: any) => (
                                                            <div key={it.id} className="px-3 py-1.5 grid grid-cols-12 gap-2 items-center">
                                                                <span className="col-span-8 font-semibold truncate">{it.item?.description || it.item?.sku || "Item"}</span>
                                                                <span className="col-span-4 text-right font-mono font-bold">{Number(it.quantity)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {req.notes && (
                                                    <div className="text-xs bg-muted/30 p-2 rounded border text-muted-foreground italic">
                                                        "{req.notes}"
                                                    </div>
                                                )}

                                                <Button
                                                    onClick={() => openWarehouseInspectModal(req)}
                                                    className="w-full font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                                >
                                                    <Scan className="h-4 w-4" />
                                                    Inspect & Receive Stock
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="text-lg">Transfer Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {transferMode === 'WAREHOUSE_TO_OUTLET' ? (
                            <>
                                <div className="space-y-1 p-3 bg-primary/5 rounded-md border border-primary/10">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Source (From)</Label>
                                    <div className="flex items-center gap-2 font-semibold mb-2">
                                        <WarehouseIcon className="h-4 w-4 text-primary" />
                                        <span>Warehouse</span>
                                    </div>
                                    <Autocomplete
                                        options={warehouseOptions}
                                        value={selectedWarehouseId}
                                        onValueChange={(val) => {
                                            setSelectedWarehouseId(val);
                                            loadLocations(val);
                                            setSelectedItems([]);
                                        }}
                                        placeholder="Search warehouse..."
                                    />
                                </div>

                                <div className="flex justify-center py-1">
                                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground rotate-90" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Destination Location (Shop / Counter)</Label>
                                    <Autocomplete
                                        options={locationOptions}
                                        value={destLocationId}
                                        onValueChange={setDestLocationId}
                                        placeholder="Search destination..."
                                    />
                                </div>
                            </>
                        ) : transferMode === 'OUTLET_TO_WAREHOUSE' ? (
                            <>
                                <div className="space-y-1 p-3 rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/30">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Source (From)</Label>
                                    <div className="space-y-2 mt-1">
                                        <Autocomplete
                                            options={locationOptions}
                                            value={destLocationId}
                                            onValueChange={(val) => {
                                                setDestLocationId(val);
                                                setSelectedItems([]);
                                            }}
                                            placeholder="Search outlet / counter..."
                                        />
                                        {destLocationId && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Package className="h-3 w-3" />
                                                Stock will be deducted from this outlet
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-1 py-1">
                                    <ArrowDown className="h-5 w-5 text-orange-500" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-500">Return</span>
                                    <ArrowDown className="h-5 w-5 text-orange-500" />
                                </div>

                                <div className="space-y-1 p-3 bg-orange-50 rounded-md border-2 border-orange-300">
                                    <Label className="text-xs text-orange-600 uppercase tracking-wider font-semibold">Destination (To)</Label>
                                    <div className="flex items-center gap-2 font-semibold text-orange-800 mt-2">
                                        <WarehouseIcon className="h-4 w-4" />
                                        <span className="flex-1">Main Warehouse Stock</span>
                                    </div>
                                    <div className="mt-2">
                                        <Autocomplete
                                            options={warehouseOptions}
                                            value={selectedWarehouseId}
                                            onValueChange={(val) => {
                                                setSelectedWarehouseId(val);
                                                loadLocations(val);
                                                setSelectedItems([]);
                                            }}
                                            placeholder="Select warehouse..."
                                        />
                                    </div>
                                    <p className="text-xs text-orange-600 mt-1">
                                        Returned items will be restocked here
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Source Location (From)</Label>
                                    <Autocomplete
                                        options={locationOptions}
                                        value={sourceLocationId}
                                        onValueChange={(val) => {
                                            setSourceLocationId(val);
                                            setSelectedItems([]);
                                        }}
                                        placeholder="Search source outlet..."
                                    />
                                </div>

                                <div className="flex justify-center py-1">
                                    <ArrowRightLeft className="h-5 w-5 text-muted-foreground rotate-90" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Destination Location (To)</Label>
                                    <Autocomplete
                                        options={locationOptions.filter(l => l.value !== sourceLocationId)}
                                        value={destLocationId}
                                        onValueChange={setDestLocationId}
                                        placeholder="Search destination outlet..."
                                    />
                                </div>
                            </>
                        )}

                        <div className="pt-4 border-t mt-4">
                            <Label htmlFor="global-notes">Global Notes</Label>
                            <Input
                                id="global-notes"
                                placeholder="Reason for transfer..."
                                value={globalNotes}
                                onChange={(e) => setGlobalNotes(e.target.value)}
                                className="mt-2"
                            />
                        </div>

                        <Button
                            className="w-full mt-4"
                            size="lg"
                            disabled={submitting || selectedItems.length === 0}
                            onClick={handleTransfer}
                        >
                            <Save className="h-5 w-5 mr-2" />
                            {submitting ? 'Processing...' : 'Submit Transfer'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle>Items & Quantities</CardTitle>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                {selectedItems.length > 0 && (
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold gap-1 px-2 py-0.5 text-xs">
                                        <Save className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Draft Saved
                                    </Badge>
                                )}
                                <Badge variant="secondary">{selectedItems.length} Items Selected</Badge>
                                {selectedItems.length > 0 && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold">
                                        Total QTY: {selectedItems.reduce((sum, i) => sum + (i.quantity || 0), 0)}
                                    </Badge>
                                )}
                                {selectedItems.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-muted-foreground hover:text-destructive font-medium px-2"
                                        onClick={clearDraft}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear List
                                    </Button>
                                )}
                            </div>
                            {/* Filter Sheet Trigger */}
                            <div className="flex items-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="relative inline-flex">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => setIsFilterOpen(true)}
                                            >
                                                <Filter className="h-4 w-4" />
                                            </Button>
                                            {activeFilterCount > 0 && (
                                                <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground flex items-center justify-center z-10">
                                                    {activeFilterCount}
                                                </span>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active — click to edit` : 'Filter items by brand, category, silhouette or gender'}
                                    </TooltipContent>
                                </Tooltip>

                                {activeFilterCount > 0 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPendingBrandIds([]); setPendingCategoryIds([]);
                                                    setPendingSilhouetteIds([]); setPendingGenderIds([]);
                                                    const cleared = { brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] };
                                                    setAppliedFilters(cleared);
                                                    setItemOptions([]);
                                                }}
                                                className="flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Clear all filters</TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">


                            {/* Filter Sheet */}
                            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                                <SheetContent side="right" className="w-[360px] sm:w-[400px] flex flex-col p-0">
                                    <SheetHeader className="px-5 pt-5 pb-3 border-b">
                                        <SheetTitle className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-primary" />
                                            Filter Items
                                            {activeFilterCount > 0 && (
                                                <Badge className="h-5 text-[10px] px-1.5 bg-primary text-primary-foreground">{activeFilterCount}</Badge>
                                            )}
                                        </SheetTitle>
                                        <div className="relative mt-2">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Search across all filters..."
                                                value={filterSearch}
                                                onChange={e => setFilterSearch(e.target.value)}
                                                className="pl-9 h-9 text-sm"
                                            />
                                            {filterSearch && (
                                                <button type="button" onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                                </button>
                                            )}
                                        </div>
                                    </SheetHeader>

                                    <ScrollArea className="flex-1 px-5 py-3">
                                        <div className="space-y-3">
                                            {(
                                                [
                                                    { key: 'brand', label: 'Brand', items: brands, ids: pendingBrandIds, setIds: setPendingBrandIds },
                                                    { key: 'category', label: 'Category', items: categories, ids: pendingCategoryIds, setIds: setPendingCategoryIds },
                                                    { key: 'silhouette', label: 'Silhouette', items: silhouettes, ids: pendingSilhouetteIds, setIds: setPendingSilhouetteIds },
                                                    { key: 'gender', label: 'Gender', items: genders, ids: pendingGenderIds, setIds: setPendingGenderIds },
                                                ] as const
                                            ).map(({ key, label, items, ids, setIds }) => {
                                                const filtered = filterSearch
                                                    ? items.filter((i: any) => i.name.toLowerCase().includes(filterSearch.toLowerCase()))
                                                    : items;
                                                if (filtered.length === 0) return null;
                                                const isCollapsed = collapsedSections[key];
                                                const selectedCount = ids.length;
                                                return (
                                                    <div key={key} className="rounded-md border border-border overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSection(key)}
                                                            className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span>{label}</span>
                                                                {selectedCount > 0 && (
                                                                    <Badge variant="secondary" className="h-4 text-[10px] px-1">{selectedCount}</Badge>
                                                                )}
                                                            </div>
                                                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")} />
                                                        </button>
                                                        {!isCollapsed && (
                                                            <div className="p-3">
                                                                <ScrollArea className="h-[180px]" showShadows>
                                                                    <div className="flex flex-wrap gap-1.5 pr-3">
                                                                        {filtered.map((item: any) => (
                                                                            <button
                                                                                key={item.id}
                                                                                type="button"
                                                                                onClick={() => (setIds as any)((prev: string[]) =>
                                                                                    prev.includes(item.id) ? prev.filter((x: string) => x !== item.id) : [...prev, item.id]
                                                                                )}
                                                                                className={cn(
                                                                                    "px-2.5 py-1 rounded-full text-xs border transition-all",
                                                                                    ids.includes(item.id)
                                                                                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                                                                                        : "bg-background border-border hover:border-primary/60 hover:bg-primary/5"
                                                                                )}
                                                                            >{item.name}</button>
                                                                        ))}
                                                                    </div>
                                                                </ScrollArea>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>

                                    <SheetFooter className="px-5 py-4 border-t flex-row gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => {
                                                const newFilters = {
                                                    brandIds: pendingBrandIds,
                                                    categoryIds: pendingCategoryIds,
                                                    silhouetteIds: pendingSilhouetteIds,
                                                    genderIds: pendingGenderIds,
                                                };
                                                setAppliedFilters(newFilters);
                                                setIsFilterOpen(false);
                                                handleItemSearch(searchQuery, newFilters);
                                                if (!isPopoverOpen) setIsPopoverOpen(true);
                                            }}
                                        >
                                            Apply Filters
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setPendingBrandIds([]); setPendingCategoryIds([]);
                                                setPendingSilhouetteIds([]); setPendingGenderIds([]);
                                                const cleared = { brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] };
                                                setAppliedFilters(cleared);
                                                setItemOptions([]);
                                            }}
                                        >
                                            <X className="h-3.5 w-3.5 mr-1" /> Clear
                                        </Button>
                                    </SheetFooter>
                                </SheetContent>
                            </Sheet>

                            {/* Search & bulk add */}
                            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                                {/* Barcode / Search Tabs */}
                                <div className="flex border-b border-muted/50 mb-4 gap-2 pb-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setBarcodeTab('scan')}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-all select-none focus:outline-none",
                                            barcodeTab === 'scan'
                                                ? "border-primary text-primary font-bold"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <ScanBarcode className="h-4 w-4" />
                                        Barcode Scanning
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBarcodeTab('search')}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-xs tracking-wider uppercase transition-all select-none focus:outline-none",
                                            barcodeTab === 'search'
                                                ? "border-primary text-primary font-bold"
                                                : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Search className="h-4 w-4" />
                                        Manual Bulk Search
                                    </button>
                                </div>

                                {barcodeTab === 'scan' ? (
                                    <div className="space-y-4">
                                        <style dangerouslySetInnerHTML={{ __html: `
                                            @keyframes laser-sweep {
                                                0% { top: 0%; opacity: 0.2; }
                                                50% { opacity: 1; }
                                                100% { top: 100%; opacity: 0.2; }
                                            }
                                            .animate-laser-sweep {
                                                animation: laser-sweep 2.5s infinite ease-in-out;
                                            }
                                        `}} />

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Visual scanner glowing box */}
                                            <div className="md:col-span-1 relative h-36 bg-neutral-950 rounded-lg overflow-hidden border border-primary/20 flex flex-col items-center justify-center p-4 group select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                                                {/* Glowing background pulses */}
                                                <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors duration-500" />
                                                
                                                {/* Simulated laser scan line */}
                                                <div className="absolute left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] animate-laser-sweep z-10" />
                                                
                                                {/* Visual scanner elements */}
                                                <div className="z-20 text-center space-y-2">
                                                    <div className="inline-flex p-2 bg-neutral-900 border border-neutral-800 rounded-full text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]">
                                                        <ScanBarcode className={cn("h-6 w-6", scanning ? "animate-pulse" : "")} />
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono font-bold">
                                                        {scanning ? 'Resolving Code...' : 'Scanner Hook Active'}
                                                    </div>
                                                    <div className="text-[11px] text-neutral-400">
                                                        Press <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-850 rounded text-[10px] font-mono text-primary font-bold shadow-sm">F2</kbd> to focus scanner
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Main Scanning Controls and inputs */}
                                            <div className="md:col-span-2 space-y-3 flex flex-col justify-between">
                                                <div className="flex flex-col md:flex-row gap-3 items-end">
                                                    {/* Bulk quantity multiplier */}
                                                    <div className="w-full md:w-24 space-y-1">
                                                        <Label htmlFor="scan-qty" className="text-xs text-muted-foreground">Scan Qty</Label>
                                                        <Input
                                                            id="scan-qty"
                                                            type="number"
                                                            min="1"
                                                            value={bulkQty}
                                                            onChange={e => setBulkQty(Number(e.target.value))}
                                                            className="h-9 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                        />
                                                    </div>

                                                    {/* Scanner input field */}
                                                    <div className="flex-1 space-y-1 w-full">
                                                        <Label htmlFor="barcode-scanner-input" className="text-xs text-muted-foreground">Scan Barcode / SKU</Label>
                                                        <div className="relative">
                                                            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                                            <Input
                                                                id="barcode-scanner-input"
                                                                ref={scannerInputRef}
                                                                type="text"
                                                                placeholder="Scan with handheld scanner, or type SKU and hit Enter..."
                                                                value={scannerInput}
                                                                onChange={e => setScannerInput(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleBarcodeResolve(scannerInput);
                                                                        setScannerInput('');
                                                                    }
                                                                }}
                                                                className="h-9 pl-9 pr-10 border-primary/30 focus-visible:ring-primary shadow-sm font-mono text-sm"
                                                            />
                                                            {scanning && (
                                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Scanner Config Settings */}
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs select-none border-t border-muted/50">
                                                    <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                                                        <input
                                                            type="checkbox"
                                                            checked={globalScannerActive}
                                                            onChange={e => setGlobalScannerActive(e.target.checked)}
                                                            className="rounded border-neutral-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                                        />
                                                        <div className="flex items-center gap-1">
                                                            <Keyboard className="h-3.5 w-3.5 text-muted-foreground/75" />
                                                            <span>Global Background Listener</span>
                                                        </div>
                                                    </label>

                                                    <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors font-medium">
                                                        <input
                                                            type="checkbox"
                                                            checked={autoIncrement}
                                                            onChange={e => setAutoIncrement(e.target.checked)}
                                                            className="rounded border-neutral-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                                        />
                                                        <div className="flex items-center gap-1">
                                                            <Plus className="h-3.5 w-3.5 text-muted-foreground/75" />
                                                            <span>Auto-increment quantity</span>
                                                        </div>
                                                    </label>

                                                    <button
                                                        type="button"
                                                        onClick={() => setSoundEnabled(!soundEnabled)}
                                                        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-medium md:ml-auto"
                                                    >
                                                        {soundEnabled ? (
                                                            <>
                                                                <Volume2 className="h-3.5 w-3.5 text-primary" />
                                                                <span>Sound Cues Enabled</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <VolumeX className="h-3.5 w-3.5 text-muted-foreground/70" />
                                                                <span>Muted</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Last Scanned Feedback Banner */}
                                        {lastScannedItem && (
                                            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded px-3 py-2 text-xs animate-fade-in">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="font-mono bg-primary text-primary-foreground font-bold px-1.5 py-0.5 rounded text-[10px]">{lastScannedItem.sku}</span>
                                                    <span className="truncate text-foreground font-medium">{lastScannedItem.description}</span>
                                                    <span className="text-muted-foreground">successfully added.</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground/75 font-mono italic whitespace-nowrap">{lastScannedItem.timestamp}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex flex-col md:flex-row gap-3 items-end">
                                            <div className="w-full md:w-32 space-y-1.5">
                                                <Label htmlFor="bulk-qty" className="text-xs text-muted-foreground">Bulk Qty</Label>
                                                <Input
                                                    id="bulk-qty"
                                                    type="number"
                                                    min="1"
                                                    value={bulkQty}
                                                    onChange={(e) => setBulkQty(Number(e.target.value))}
                                                    className="h-10 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>

                                            <div className="flex-1 space-y-1.5 relative w-full">
                                                <Label htmlFor="item-search" className="text-xs text-muted-foreground">Search Items (Select Multiple)</Label>
                                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                                    <PopoverTrigger asChild>
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input
                                                                id="item-search"
                                                                placeholder="Type SKU or description to search..."
                                                                value={searchQuery}
                                                                onChange={(e) => handleItemSearch(e.target.value)}
                                                                onFocus={() => searchQuery.length >= 2 && setIsPopoverOpen(true)}
                                                                className="h-10 pl-10 border-primary/20 focus-visible:ring-primary shadow-sm"
                                                            />
                                                            {searchLoading && (
                                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                                            )}
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-primary/10"
                                                        align="start"
                                                        onOpenAutoFocus={(e: Event) => e.preventDefault()}
                                                    >
                                                        <Command className="rounded-lg" shouldFilter={false}>
                                                            <CommandList className="max-h-[350px]">
                                                                {itemOptions.length === 0 ? (
                                                                    <div className="py-6 px-4 text-center space-y-1">
                                                                        {searchLoading ? (
                                                                            <p className="text-sm text-muted-foreground">Searching...</p>
                                                                        ) : searchQuery.length > 0 && activeFilterCount > 0 ? (
                                                                            <>
                                                                                <p className="text-sm font-medium text-muted-foreground">No results for "{searchQuery}"</p>
                                                                                <p className="text-xs text-muted-foreground">with {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}. Try clearing some filters.</p>
                                                                            </>
                                                                        ) : searchQuery.length > 0 ? (
                                                                            <>
                                                                                <p className="text-sm font-medium text-muted-foreground">No items match "{searchQuery}"</p>
                                                                                <p className="text-xs text-muted-foreground">Try a different SKU or description.</p>
                                                                            </>
                                                                        ) : activeFilterCount > 0 ? (
                                                                            <>
                                                                                <p className="text-sm font-medium text-muted-foreground">No items match the active filters</p>
                                                                                <p className="text-xs text-muted-foreground">Try removing some filters or type a search term.</p>
                                                                            </>
                                                                        ) : (
                                                                            <p className="text-sm text-muted-foreground">Type at least 2 characters to search, or apply filters above.</p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <CommandGroup>
                                                                        <div className="flex items-center justify-between px-3 py-1.5 border-b border-muted/50">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Results</span>
                                                                                <span className="text-xs text-muted-foreground">({itemOptions.length})</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                className="text-xs text-primary underline underline-offset-2 hover:text-primary/70 transition-colors"
                                                                                onClick={() => {
                                                                                    const unselected = itemOptions
                                                                                        .map((o: any) => o.item)
                                                                                        .filter((item: any) => !selectedItems.some(s => s.id === item.id));
                                                                                    unselected.forEach((item: any) => toggleItemSelection(item));
                                                                                }}
                                                                            >
                                                                                Select all
                                                                            </button>
                                                                        </div>
                                                                        <ScrollArea showShadows={true} shadowSize="md" className="h-[300px]">
                                                                            {itemOptions.map((opt) => {
                                                                                const item = (opt as any).item;
                                                                                const isSelected = selectedItems.some(i => i.id === item.id);
                                                                                return (
                                                                                    <CommandItem
                                                                                        key={item.id}
                                                                                        value={`${item.sku} ${item.description}`}
                                                                                        onSelect={() => toggleItemSelection(item)}
                                                                                        className={cn(
                                                                                            "flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-muted/50 last:border-0",
                                                                                            isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-accent"
                                                                                        )}
                                                                                    >
                                                                                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className={cn(
                                                                                                    "font-mono text-[10px] px-1.5 py-0.5 rounded border leading-none font-bold",
                                                                                                    isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-muted-foreground/20"
                                                                                                )}>
                                                                                                    {item.sku}
                                                                                                </span>
                                                                                                <span className={cn(
                                                                                                    "truncate text-sm",
                                                                                                    isSelected ? "font-bold text-primary" : "font-medium"
                                                                                                )}>
                                                                                                    {item.description}
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                                                    <WarehouseIcon className="h-3 w-3" />
                                                                                                    Stock: <span className={cn("font-bold", item.availableStock > 0 ? "text-foreground" : "text-destructive")}>{item.availableStock}</span>
                                                                                                </span>
                                                                                                {item.color?.name && (
                                                                                                    <span className="text-[11px] text-muted-foreground">
                                                                                                        • Color: <span className="font-semibold text-foreground">{item.color.name}</span>
                                                                                                    </span>
                                                                                                )}
                                                                                                {item.size?.name && (
                                                                                                    <span className="text-[11px] text-muted-foreground">
                                                                                                        • Size: <span className="font-semibold text-foreground">{item.size.name}</span>
                                                                                                    </span>
                                                                                                )}
                                                                                                {isSelected && (
                                                                                                    <Badge variant="outline" className="h-4 text-[9px] px-1 bg-primary/5 text-primary border-primary/20">Added</Badge>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="shrink-0 flex items-center justify-center w-8">
                                                                                            {isSelected ? (
                                                                                                <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                                                                                            ) : (
                                                                                                <Plus className="h-4 w-4 text-muted-foreground opacity-50" />
                                                                                            )}
                                                                                        </div>
                                                                                    </CommandItem>
                                                                                );
                                                                            })}
                                                                        </ScrollArea>
                                                                    </CommandGroup>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground bg-primary/5 p-2 rounded border border-primary/5">
                                            <div className="flex items-center gap-2 text-primary font-medium italic">
                                                <Info className="h-3 w-3" />
                                                <span>Click items in the list to toggle selection. Popover stays open for multiple selects.</span>
                                            </div>
                                            <div className="flex items-center gap-3 font-semibold">
                                                <span>{selectedItems.length} items currently in list</span>
                                                {selectedItems.length > 0 && (
                                                    <span className="text-primary font-bold">
                                                        · Total QTY: {selectedItems.reduce((sum, i) => sum + (i.quantity || 0), 0)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-[150px]">SKU</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[120px]">Color</TableHead>
                                        <TableHead className="w-[80px]">Size</TableHead>
                                        <TableHead className="w-[100px] text-center">In Stock</TableHead>
                                        <TableHead className="w-[120px]">Transfer Qty</TableHead>
                                        <TableHead>Item Notes</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">
                                                No items added yet. Search and add items above.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        selectedItems.map((item) => (
                                            <TableRow key={item.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-mono text-xs font-semibold">{item.sku}</TableCell>
                                                <TableCell>
                                                    <span className="text-sm font-medium">{item.description}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-semibold">
                                                    {item.color || <span className="text-muted-foreground/30">—</span>}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-semibold">
                                                    {item.size || <span className="text-muted-foreground/30">—</span>}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-primary">{item.availableStock}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItemQuantity(item.id, Number(e.target.value))}
                                                        className="h-8 focus-visible:ring-primary shadow-none bg-transparent group-hover:bg-background transition-colors"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        placeholder="Add note..."
                                                        value={item.notes}
                                                        onChange={(e) => updateItemNotes(item.id, e.target.value)}
                                                        className="h-8 focus-visible:ring-primary shadow-none bg-transparent group-hover:bg-background transition-colors"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                                        onClick={() => removeItem(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                    {selectedItems.length > 0 && (
                                        <TableRow className="bg-muted/40 border-t-2 border-primary/20">
                                            <TableCell colSpan={4} className="text-xs font-bold text-muted-foreground uppercase tracking-wider py-2.5 pl-4">
                                                Total
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-primary text-sm py-2.5">
                                                {selectedItems.reduce((sum, i) => sum + (i.availableStock || 0), 0)}
                                            </TableCell>
                                            <TableCell className="font-bold text-foreground text-sm py-2.5">
                                                <span className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-2.5 py-1 rounded-md text-xs font-bold">
                                                    {selectedItems.reduce((sum, i) => sum + (i.quantity || 0), 0)} QTY
                                                </span>
                                            </TableCell>
                                            <TableCell colSpan={2} />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            )}
            </div>

            {/* Inspect & Custom Receiving Modal for Warehouse */}
            <Dialog open={!!inspectingRequest} onOpenChange={(open) => !open && setInspectingRequest(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <PackageCheck className="h-6 w-6 text-emerald-600" />
                            Warehouse Stock Receiving — {inspectingRequest?.requestNo}
                        </DialogTitle>
                        <DialogDescription>
                            Scan barcodes to count items, verify sent quantities vs actual physical stock received, and enter receiving notes.
                        </DialogDescription>
                    </DialogHeader>

                    {inspectingRequest && (
                        <div className="flex-1 overflow-y-auto space-y-4 my-2 pr-2.5 [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 hover:[&::-webkit-scrollbar-thumb]:bg-primary/70 [&::-webkit-scrollbar-thumb]:rounded-full">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg text-xs font-semibold">
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">From Location</span>
                                    <span>{inspectingRequest.fromLocation?.name || inspectingRequest.fromLocationId || "Outlet Store"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Date Sent</span>
                                    <span>{new Date(inspectingRequest.createdAt).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[10px] uppercase">Destination Warehouse</span>
                                    <span>{inspectingRequest.fromWarehouse?.name || "Main Warehouse"}</span>
                                </div>
                            </div>

                            {/* Barcode / SKU Scanner Control Bar */}
                            <div className="bg-muted/30 border border-emerald-500/30 p-3 rounded-lg flex flex-col sm:flex-row items-center gap-3">
                                <div className="flex-1 flex items-center gap-2 w-full">
                                    <div className="relative flex-1">
                                        <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                                        <Input
                                            ref={modalScannerRef}
                                            placeholder="Scan Item Barcode / SKU (or press F2 to focus)..."
                                            value={modalScanInput}
                                            onChange={(e) => setModalScanInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleModalScanBarcode(modalScanInput);
                                                }
                                            }}
                                            className="pl-9 pr-8 font-mono text-xs sm:text-sm bg-background border-emerald-500/30 focus-visible:ring-emerald-500 h-9"
                                        />
                                        {modalScanInput && (
                                            <button
                                                type="button"
                                                onClick={() => setModalScanInput("")}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <Button 
                                        type="button" 
                                        size="sm"
                                        onClick={() => handleModalScanBarcode(modalScanInput)} 
                                        className="font-bold h-9 gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <Barcode className="h-4 w-4" />
                                        Scan
                                    </Button>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-[11px] h-8 font-semibold"
                                        onClick={() => {
                                            const zeroMap: Record<string, number> = {};
                                            inspectingRequest.items?.forEach((i: any) => { zeroMap[i.itemId] = 0; });
                                            setReceivedQtyMap(zeroMap);
                                            toast.info("All received quantities set to 0. You can now scan items one by one.");
                                        }}
                                    >
                                        Reset to 0
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="text-[11px] h-8 font-semibold"
                                        onClick={() => {
                                            const sentMap: Record<string, number> = {};
                                            inspectingRequest.items?.forEach((i: any) => { sentMap[i.itemId] = Number(i.quantity || 0); });
                                            setReceivedQtyMap(sentMap);
                                            toast.info("All received quantities filled with dispatched quantities.");
                                        }}
                                    >
                                        Fill Sent Qty
                                    </Button>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-x-auto max-h-[45vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted/20 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 hover:[&::-webkit-scrollbar-thumb]:bg-primary/70 [&::-webkit-scrollbar-thumb]:rounded-full">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-muted/80 font-bold uppercase text-[10px] tracking-wider text-muted-foreground sticky top-0 z-10 backdrop-blur-xs">
                                        <tr>
                                            <th className="p-3">Item / SKU</th>
                                            <th className="p-3 text-center">Dispatched Qty</th>
                                            <th className="p-3 text-center w-36">Received Qty</th>
                                            <th className="p-3 text-right">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {inspectingRequest.items?.map((item: any) => {
                                            const dispatched = Number(item.quantity || 0);
                                            const rxQty = receivedQtyMap[item.itemId] !== undefined ? receivedQtyMap[item.itemId] : dispatched;
                                            const diff = rxQty - dispatched;
                                            const isLastScanned = lastScannedModalItemId === item.itemId;

                                            return (
                                                <tr key={item.id} className={`transition-colors ${isLastScanned ? "bg-emerald-500/10 font-semibold" : "hover:bg-muted/20"}`}>
                                                    <td className="p-3">
                                                        <div className="font-bold text-sm flex items-center gap-1.5">
                                                            {item.item?.description || "Item"}
                                                            {isLastScanned && (
                                                                <Badge variant="secondary" className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 py-0 px-1">Last Scanned</Badge>
                                                            )}
                                                        </div>
                                                        <div className="font-mono text-muted-foreground text-[11px]">SKU: {item.item?.sku || "N/A"}</div>
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-base">
                                                        {dispatched}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <Input
                                                            type="number"
                                                            step="1"
                                                            value={receivedQtyMap[item.itemId] ?? dispatched}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                setReceivedQtyMap(prev => ({ ...prev, [item.itemId]: val }));
                                                            }}
                                                            className="w-24 mx-auto text-center font-bold text-sm h-9"
                                                        />
                                                    </td>
                                                    <td className="p-3 text-right font-bold">
                                                        {diff === 0 ? (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Match (0)</Badge>
                                                        ) : diff < 0 ? (
                                                            <Badge variant="secondary" className="bg-rose-100 text-rose-700 border-rose-200">Shortage ({diff})</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Excess (+{diff})</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="receivingNotesModal" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receiving Notes / Remarks (Optional)</Label>
                                <Input
                                    id="receivingNotesModal"
                                    placeholder="Add any remarks regarding damaged items, shortages, or delivery condition..."
                                    value={receivingNotes}
                                    onChange={(e) => setReceivingNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
                        <Button variant="outline" onClick={() => setInspectingRequest(null)}>
                            Cancel
                        </Button>
                        <Button 
                            className="font-bold gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isAccepting === inspectingRequest?.id}
                            onClick={handleAcceptWarehouseInspected}
                        >
                            {isAccepting === inspectingRequest?.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5" />
                            )}
                            Confirm & Receive Stock into Warehouse
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <TransferBulkUploadModal
                open={isUploadModalOpen}
                onOpenChange={setIsUploadModalOpen}
                uploadId={activeUploadId}
                onUploadIdChange={handleUploadIdChange}
                onSuccess={handleBulkUploadSuccess}
                warehouseId={transferMode === 'WAREHOUSE_TO_OUTLET' ? selectedWarehouseId : ''}
                locationId={
                    transferMode === 'OUTLET_TO_WAREHOUSE'
                        ? destLocationId
                        : transferMode === 'OUTLET_TO_OUTLET'
                        ? sourceLocationId
                        : undefined
                }
            />
        </PermissionGuard>
    );
}
