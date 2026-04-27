"use client";

import { useState } from "react";
import { Plus, Monitor, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getColumns, PosRow } from "./columns";
import { Pos, createPos } from "@/lib/actions/pos";
import { Location } from "@/lib/actions/location";
import { Company } from "@/lib/actions/companies";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import DataTable from "@/components/common/data-table";

interface PosListProps {
    initialPos: Pos[];
    location: Location;
    companies: Company[];
    newItemId?: string;
}

export function PosList({ initialPos, location, companies, newItemId }: PosListProps) {
    const router = useRouter();
    const [data, setData] = useState<PosRow[]>(initialPos as PosRow[]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const columns = getColumns(companies);

    const handleCreatePos = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsPending(true);
        const formData = new FormData(e.currentTarget);

        const posData = {
            name: formData.get("name") as string,
            locationId: location.id,
            companyId: formData.get("companyId") as string || undefined,
            terminalPin: formData.get("terminalPin") as string || undefined,
            status: "active"
        };

        try {
            const result = await createPos(posData);
            if (result.status) {
                toast.success(result.message);
                setIsCreateOpen(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("An error occurred while creating POS");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">POS Terminals</h1>
                        <p className="text-muted-foreground">
                            Managing terminals for <span className="font-semibold text-foreground">{location.name}</span>
                        </p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Terminal
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleCreatePos}>
                            <DialogHeader>
                                <DialogTitle>Add New POS Terminal</DialogTitle>
                                <DialogDescription>
                                    Setup a new terminal for {location.name}. Terminal ID will be auto-generated.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Terminal Name</Label>
                                    <Input id="name" name="name" placeholder="e.g. Counter 1" required disabled={isPending} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="companyId">Link to Company</Label>
                                    <Select name="companyId" disabled={isPending}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Company" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map((company) => (
                                                <SelectItem key={company.id} value={company.id}>
                                                    {company.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="terminalPin">Initial PIN (Optional)</Label>
                                    <Input
                                        id="terminalPin"
                                        name="terminalPin"
                                        placeholder="4-6 digits"
                                        type="password"
                                        maxLength={6}
                                        disabled={isPending}
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">If not set, terminal will require setup upon first use.</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending && <Plus className="mr-2 h-4 w-4 animate-spin" />}
                                    Create Terminal
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <DataTable
                columns={columns}
                data={initialPos as PosRow[]}
                // searchPlaceholder="Search terminals..."
                newItemId={newItemId}
            />
        </div>
    );
}
