 "use client";
 
 import { useTransition } from "react";
 import { useForm } from "react-hook-form";
 import { useRouter } from "next/navigation";
 import { Button } from "@/components/ui/button";
 import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { toast } from "sonner";
 import { createCustomer } from "@/lib/actions/customer";
 
 interface FormValues {
   code: string;
   name: string;
   address?: string;
   contactNo?: string;
 }
 
 export default function CreateCustomerPage() {
   const [isPending, startTransition] = useTransition();
   const router = useRouter();
   const { register, handleSubmit, reset } = useForm<FormValues>({
     defaultValues: { code: "", name: "", address: "", contactNo: "" },
   });
 
   const onSubmit = (data: FormValues) => {
     startTransition(async () => {
       const res = await createCustomer(data);
       if (res?.status) {
         toast.success("Customer created");
         router.push("/erp/sales/customers");
       } else {
         toast.error(res?.message || "Failed");
       }
     });
   };
 
   return (
     <div className="flex-1 space-y-4 p-8 pt-6">
       <div className="flex items-center justify-between space-y-2">
         <h2 className="text-3xl font-bold tracking-tight">Add Customer</h2>
       </div>
       <div className="grid gap-4 grid-cols-1">
         <Card>
           <CardHeader>
             <CardTitle>Customer Details</CardTitle>
           </CardHeader>
           <CardContent>
             <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-12 gap-4">
               <div className="col-span-3 space-y-2">
                 <Label>Code</Label>
                 <Input {...register("code", { required: true })} placeholder="Code" />
               </div>
               <div className="col-span-3 space-y-2">
                 <Label>Name of Customer</Label>
                 <Input {...register("name", { required: true })} placeholder="Name of Customer" />
               </div>
               <div className="col-span-4 space-y-2">
                 <Label>Address</Label>
                 <Input {...register("address")} placeholder="Address" />
               </div>
               <div className="col-span-2 space-y-2">
                 <Label>Contact No.</Label>
                 <Input {...register("contactNo")} placeholder="Contact No." />
               </div>
               <div className="col-span-12">
                 <Button type="submit" disabled={isPending}>Submit</Button>
               </div>
             </form>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }
