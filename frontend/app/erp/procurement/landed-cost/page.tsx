 'use client';
 
 import { useEffect, useState } from 'react';
 import Link from 'next/link';
 import { useRouter } from 'next/navigation';
 import { Button } from '@/components/ui/button';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
import { Grn, chartOfAccountApi, ChartOfAccount } from '@/lib/api';
import { landedCostChargeTypeApi, LandedCostChargeType } from '@/lib/api';
import { getGrns } from '@/lib/actions/grn';
import { postLandedCost } from '@/lib/actions/landed-cost';
import { Eye, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/providers/auth-provider';
import { PermissionGuard } from '@/components/auth/permission-guard';
 
 export default function LandedCostPage() {
   const router = useRouter();
   const [grns, setGrns] = useState<Grn[]>([]);
   const [loading, setLoading] = useState(true);
   const [orderTypeFilter, setOrderTypeFilter] = useState<'ALL' | 'LOCAL' | 'IMPORT'>('ALL');
   const [postingId, setPostingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [chargeTypes, setChargeTypes] = useState<LandedCostChargeType[]>([]);
  const [openForGrn, setOpenForGrn] = useState<string | null>(null);
  const [charges, setCharges] = useState<{ accountId: string; amount: number }[]>([]);
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('erp.procurement.landed-cost.create');
 
   useEffect(() => {
     loadGrns();
    loadAccounts();
    loadChargeTypes();
   }, []);
 
   const loadGrns = async () => {
     try {
       const data = await getGrns();
       // Filter for GRNs that need landed cost:
       // 1. Direct PO (no PR/RFQ) - always needs landed cost
       // 2. PR-linked FINISH GOODS - needs landed cost
       setGrns(data.filter((g) => {
         if (g.status !== 'RECEIVED_UNVALUED') return false;
         
         // Check if it's a direct PO or PR-linked FINISH GOODS
         const po = (g as any).purchaseOrder;
         if (!po) return false;
         
         const isDirectPo = !po.purchaseRequisitionId && !po.vendorQuotationId && !po.rfqId;
         const isPrLinkedFresh = po.purchaseRequisition?.goodsType === 'FRESH';
         
         return isDirectPo || isPrLinkedFresh;
       }));
     } catch (error) {
       console.error('Failed to load GRNs:', error);
     } finally {
       setLoading(false);
     }
   };

   const getFilteredGrns = () => {
     let filtered = grns;
     if (orderTypeFilter === 'LOCAL') {
       filtered = grns.filter(g => g.orderType === 'LOCAL' || !g.orderType);
     } else if (orderTypeFilter === 'IMPORT') {
       filtered = grns.filter(g => g.orderType === 'IMPORT');
     }
     return filtered;
   };
  
  const loadAccounts = async () => {
    try {
      const data = await chartOfAccountApi.getAll();
      setAccounts(data.filter((a) => !a.isGroup));
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };
  const loadChargeTypes = async () => {
    try {
      const res = await landedCostChargeTypeApi.getAll();
      setChargeTypes(res?.data || []);
    } catch {}
  };
 
  const postLandedCost = async (grnId: string) => {
     try {
       setPostingId(grnId);
      const payload = {
        grnId,
        charges: charges.filter(c => c.accountId && c.amount > 0),
      };
      const result = await postLandedCost(payload);
       toast.success(`Landed Cost posted. GRN status: ${result.grnStatus}`);
       await loadGrns();
      setOpenForGrn(null);
      setCharges([]);
     } catch (error: any) {
       toast.error(error.message || 'Failed to post landed cost');
     } finally {
       setPostingId(null);
     }
   };
  
  const addChargeRow = () => {
    setCharges((prev) => [...prev, { accountId: '', amount: 0 }]);
  };
  const updateCharge = (idx: number, patch: Partial<{ accountId: string; amount: number }>) => {
    setCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
 
   return (
     <PermissionGuard permissions="erp.procurement.landed-cost.read">
     <div className="p-6 space-y-6">
       <div className="flex justify-between items-center">
         <div>
           <h1 className="text-3xl font-bold tracking-tight">Landed Cost</h1>
          <p className="text-muted-foreground">Post Landed Cost for received, unvalued GRNs. Add charges to create JV.</p>
         </div>
         <div className="flex gap-2">
           <Select value={orderTypeFilter} onValueChange={(v: any) => setOrderTypeFilter(v)}>
             <SelectTrigger className="w-32">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="ALL">All Types</SelectItem>
               <SelectItem value="LOCAL">Local</SelectItem>
               <SelectItem value="IMPORT">Import</SelectItem>
             </SelectContent>
           </Select>
           <Button variant="outline" asChild>
             <Link href="/erp/procurement/landed-cost/setup">Setup</Link>
           </Button>         </div>
       </div>
 
       <Card>
         <CardHeader>
           <CardTitle>GRNs Awaiting Valuation</CardTitle>
         </CardHeader>
         <CardContent>
           {loading ? (
             <div className="text-center py-10">Loading...</div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>GRN Number</TableHead>
                   <TableHead>PO Number</TableHead>
                   <TableHead>Warehouse</TableHead>
                   <TableHead>Order Type</TableHead>
                   <TableHead>Goods Type</TableHead>
                   <TableHead>Received Date</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {getFilteredGrns().length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={8} className="text-center h-24">
                       No GRNs pending valuation.
                     </TableCell>
                   </TableRow>
                 ) : (
                   getFilteredGrns().map((grn) => (
                     <TableRow key={grn.id}>
                       <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                       <TableCell className="font-mono text-sm">{grn.purchaseOrder?.poNumber || 'N/A'}</TableCell>
                       <TableCell>{grn.warehouse?.name}</TableCell>
                       <TableCell>
                         {grn.orderType ? (
                           <Badge variant="outline" className="text-xs">
                             {grn.orderType === 'IMPORT' ? 'Import' : 'Local'}
                           </Badge>
                         ) : (
                           <span className="text-muted-foreground text-xs">-</span>
                         )}
                       </TableCell>
                       <TableCell>
                         {grn.goodsType ? (
                           <Badge variant="outline" className="text-xs">
                             {grn.goodsType === 'FRESH' ? 'Fresh' : 'Consumable'}
                           </Badge>
                         ) : (
                           <span className="text-muted-foreground text-xs">-</span>
                         )}
                       </TableCell>
                       <TableCell>{new Date(grn.receivedDate).toLocaleDateString()}</TableCell>
                       <TableCell>
                         <Badge variant="secondary">{grn.status}</Badge>
                       </TableCell>
                       <TableCell className="text-right flex justify-end gap-2">
                         <Button variant="ghost" size="sm" asChild>
                           <Link href={`/erp/procurement/grn/${grn.id}`}>
                             <Eye className="h-4 w-4 mr-2" />
                             View
                           </Link>
                         </Button>
                         <Button
                           size="sm"
                           onClick={() => {
                             router.push(`/erp/procurement/landed-cost/setup?grnId=${grn.id}`);
                           }}
                           disabled={!canCreate}
                         >
                           <Check className="h-4 w-4 mr-2" />
                           Post Landed Cost
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           )}
         </CardContent>
       </Card>
     </div>
     </PermissionGuard>
   );
 }
