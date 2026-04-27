 'use client';
 
 import { useEffect, useState } from 'react';
 import { useParams, useRouter } from 'next/navigation';
 import { Button } from '@/components/ui/button';
 import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Input } from '@/components/ui/input';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Plus } from 'lucide-react';
 import { toast } from 'sonner';
 import { ChartOfAccount, chartOfAccountApi } from '@/lib/api';
 import { landedCostChargeTypeApi, LandedCostChargeType } from '@/lib/api';
 import type { Grn } from '@/lib/api';
 import { getGrn } from '@/lib/actions/grn';
 import { postLandedCost } from '@/lib/actions/landed-cost';
 import { PermissionGuard } from '@/components/auth/permission-guard';
 
 export default function LandedCostPostPage() {
   const params = useParams();
   const router = useRouter();
   const grnId = (params?.grnId as string) || '';
 
   const [loading, setLoading] = useState(true);
   const [grn, setGrn] = useState<Grn | null>(null);
   const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
   const [chargeTypes, setChargeTypes] = useState<LandedCostChargeType[]>([]);
   const [posting, setPosting] = useState(false);
   const [charges, setCharges] = useState<{ accountId: string; amount: number }[]>([]);
   const [itemRates, setItemRates] = useState<Record<string, number>>({});
 
   useEffect(() => {
     if (!grnId) return;
     loadData();
   }, [grnId]);
 
   const loadData = async () => {
     try {
       setLoading(true);
       const [grnData, coaData, ctRes] = await Promise.all([
         getGrn(grnId),
         chartOfAccountApi.getAll(),
         landedCostChargeTypeApi.getAll(),
       ]);
       setGrn(grnData);
       setAccounts((coaData || []).filter((a) => !a.isGroup));
       setChargeTypes(ctRes?.data || []);
       setCharges([{ accountId: '', amount: 0 }]);
       const initialRates: Record<string, number> = {};
       (grnData.items || []).forEach((it: any) => {
         initialRates[it.id] = 0;
       });
       setItemRates(initialRates);
     } catch (error) {
       toast.error('Failed to load data');
     } finally {
       setLoading(false);
     }
   };
 
   const addChargeRow = () => {
     setCharges((prev) => [...prev, { accountId: '', amount: 0 }]);
   };
   const updateCharge = (idx: number, patch: Partial<{ accountId: string; amount: number }>) => {
     setCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
   };
 
   const postLandedCost = async () => {
     if (!grnId) return;
     try {
       setPosting(true);
       const payload = {
         grnId,
         charges: charges.filter((c) => c.accountId && c.amount > 0),
         itemRates: (grn?.items || []).map((it) => ({
           itemId: it.itemId,
           rate: Number(itemRates[it.id] || 0),
         })),
       };
       const result = await postLandedCost(payload);
       toast.success(`Landed Cost posted. GRN status: ${result.grnStatus}`);
       router.push('/erp/procurement/landed-cost');
     } catch (error: any) {
       toast.error(error.message || 'Failed to post landed cost');
     } finally {
       setPosting(false);
     }
   };
 
   return (
     <PermissionGuard permissions="erp.procurement.landed-cost.create">
     <div className="p-6 space-y-6">
       <div className="flex justify-between items-center">
         <div>
           <h1 className="text-3xl font-bold tracking-tight">Post Landed Cost</h1>
           <p className="text-muted-foreground">Review GRN details and add landed cost charges.</p>
         </div>
       </div>
 
       {loading || !grn ? (
         <div className="text-center py-10">Loading...</div>
       ) : (
         <>
           <Card>
             <CardHeader>
               <CardTitle>GRN Details</CardTitle>
             </CardHeader>
             <CardContent className="space-y-2">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 <div>
                   <div className="text-sm text-muted-foreground">GRN Number</div>
                   <div className="font-medium">{grn.grnNumber}</div>
                 </div>
                 <div>
                   <div className="text-sm text-muted-foreground">PO Number</div>
                   <div className="font-medium">{grn.purchaseOrder?.poNumber || 'N/A'}</div>
                 </div>
                 <div>
                   <div className="text-sm text-muted-foreground">Warehouse</div>
                   <div className="font-medium">{grn.warehouse?.name || 'N/A'}</div>
                 </div>
                 <div>
                   <div className="text-sm text-muted-foreground">Received Date</div>
                   <div className="font-medium">{new Date(grn.receivedDate).toLocaleDateString()}</div>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader>
               <CardTitle>GRN Items</CardTitle>
             </CardHeader>
             <CardContent>
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Item</TableHead>
                     <TableHead>Description</TableHead>
                     <TableHead className="text-right">Received Qty</TableHead>
                     <TableHead className="text-right">Rate</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {grn.items.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={3} className="text-center h-20">No items</TableCell>
                     </TableRow>
                   ) : (
                     grn.items.map((it) => (
                       <TableRow key={it.id}>
                         <TableCell className="font-mono text-sm">{it.itemId}</TableCell>
                         <TableCell>{it.description || '-'}</TableCell>
                         <TableCell className="text-right">{it.receivedQty}</TableCell>
                         <TableCell className="text-right">
                           <Input
                             className="text-right"
                             type="number"
                             min={0}
                             step="0.01"
                             value={itemRates[it.id] ?? 0}
                             onChange={(e) =>
                               setItemRates((prev) => ({
                                 ...prev,
                                 [it.id]: Number(e.target.value),
                               }))
                             }
                             placeholder="Rate"
                           />
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
 
           <Card>
             <CardHeader className="flex items-center justify-between">
               <CardTitle>Landed Cost Charges</CardTitle>
               <Button variant="outline" size="sm" onClick={addChargeRow}>
                 <Plus className="h-4 w-4 mr-2" />
                 Add Charge
               </Button>
             </CardHeader>
             <CardContent className="space-y-3">
               {charges.map((c, idx) => (
                 <div key={idx} className="grid grid-cols-3 gap-3">
                   <Select
                     value={chargeTypes.find(ct => ct.accountId === c.accountId)?.id || ''}
                     onValueChange={(val) => {
                       const ct = chargeTypes.find(t => t.id === val);
                       if (ct) updateCharge(idx, { accountId: ct.accountId });
                     }}
                   >
                     <SelectTrigger isLoading={chargeTypes.length === 0}>
                       <SelectValue placeholder="Select charge type" />
                     </SelectTrigger>
                     <SelectContent>
                       {chargeTypes.map((t) => (
                         <SelectItem key={t.id} value={t.id}>
                           {t.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                   <Select
                     value={c.accountId}
                     onValueChange={(val) => updateCharge(idx, { accountId: val })}
                   >
                     <SelectTrigger isLoading={accounts.length === 0}>
                       <SelectValue placeholder="Select charge account" />
                     </SelectTrigger>
                     <SelectContent>
                       {accounts
                         .filter((a) => a.type === 'EXPENSE')
                         .map((a) => (
                           <SelectItem key={a.id} value={a.id}>
                             {a.code} - {a.name}
                           </SelectItem>
                         ))}
                     </SelectContent>
                   </Select>
                   <Input
                     type="number"
                     min={0}
                     step="0.01"
                     value={c.amount}
                     onChange={(e) => updateCharge(idx, { amount: Number(e.target.value) })}
                     placeholder="Amount"
                   />
                 </div>
               ))}
               <div className="flex justify-end">
                 <Button onClick={postLandedCost} disabled={posting}>
                   {posting ? 'Posting...' : 'Post Landed Cost'}
                 </Button>
               </div>
             </CardContent>
           </Card>
         </>
       )}
     </div>
     </PermissionGuard>
   );
 }
