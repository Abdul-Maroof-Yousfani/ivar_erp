"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authFetch } from "@/lib/auth";

export default function ProfilePage() {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        avatar: "",
    });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                phone: user.phone || "",
                avatar: user.avatar || "",
            });
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await authFetch("/auth/update-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const { data } = res;

            if (data.status) {
                toast.success("Profile updated successfully");
                await refreshUser();
            } else {
                toast.error(data.message || "Failed to update profile");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Profile</h3>
                <p className="text-sm text-muted-foreground">
                    This is how others will see you on the site.
                </p>
            </div>
            <Separator />

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First name</Label>
                            <Input
                                id="firstName"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                placeholder="Enter first name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last name</Label>
                            <Input
                                id="lastName"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                placeholder="Enter last name"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" value={user.email} disabled className="bg-muted" />
                        <p className="text-[0.8rem] text-muted-foreground">
                            Email addresses cannot be changed properly.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone number</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="Enter phone number"
                        />
                    </div>
                </div>

                <div className="flex justify-start">
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update profile
                    </Button>
                </div>
            </form>

            <Separator className="my-6" />

            {/* Employee Details Section */}
            {user.employee && (
                <Card>
                    <CardHeader>
                        <CardTitle>Employee Information</CardTitle>
                        <CardDescription>Details synced with your employee record.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                        <div>
                            <Label className="text-muted-foreground">Employee ID</Label>
                            <p className="font-medium">{user.employee.employeeId}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Department</Label>
                            <p className="font-medium">{user.employee.department.name}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Designation</Label>
                            <p className="font-medium">{user.employee.designation.name}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Separator className="my-6" />

            {/* Permissions Section */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Permissions</h3>
                    <p className="text-sm text-muted-foreground">
                        Role: <span className="font-bold capitalize text-primary">{user.role?.name.replace('_', ' ')}</span>
                    </p>
                </div>

                {user.role?.permissions && user.role.permissions.length > 0 ? (
                    <PermissionsList permissions={user.role.permissions} />
                ) : (
                    <p className="text-sm text-muted-foreground">No specific permissions assigned.</p>
                )}
            </div>
        </div>
    );
}

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Shield } from "lucide-react";

function PermissionsList({ permissions }: { permissions: { permission: { name: string } }[] }) {
    // Group permissions by module (e.g., "users.view" -> module "users")
    const groupedPermissions = permissions.reduce((acc, p) => {
        const [module, action] = p.permission.name.split('.');
        const modName = module || "Other";
        if (!acc[modName]) {
            acc[modName] = [];
        }
        acc[modName].push(action || p.permission.name);
        return acc;
    }, {} as Record<string, string[]>);

    const modules = Object.keys(groupedPermissions).sort();

    return (
        <div className="columns-1 md:columns-2 gap-4 space-y-4">
            <Accordion type="multiple" className="w-full">
                {modules.map((module) => (
                    <div key={module} className="break-inside-avoid mb-4">
                        <AccordionItem value={module} className="border rounded-lg px-4 shadow-sm bg-card">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-2 capitalize">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <span>{module.replace('_', ' ')}</span>
                                    <Badge variant="secondary" className="ml-2 text-xs rounded-full h-5 px-2">
                                        {groupedPermissions[module].length}
                                    </Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 pt-1">
                                <div className="flex flex-wrap gap-2">
                                    <TooltipProvider>
                                        {groupedPermissions[module].map((action) => (
                                            <Tooltip key={action}>
                                                <TooltipTrigger asChild>
                                                    <Badge variant="outline" className="cursor-help hover:bg-primary/10 transition-colors capitalize">
                                                        {action}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <div className="flex items-center gap-2">
                                                        <Check className="h-3 w-3 text-green-500" />
                                                        <p className="capitalize">Can {action} {module.replace('_', ' ')}</p>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </TooltipProvider>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </div>
                ))}
            </Accordion>
        </div>
    );
}
