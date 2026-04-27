"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth";

export default function PasswordPage() {
    const { logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.newPassword !== formData.confirmPassword) {
            toast.error("New passwords do not match");
            return;
        }

        if (formData.newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        try {
            const res = await authFetch("/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    oldPassword: formData.oldPassword,
                    newPassword: formData.newPassword,
                }),
            });

            const data = res.data;

            if (data.status) {
                toast.success("Password changed successfully. Please login again.");
                await logout();
            } else {
                toast.error(data.message || "Failed to change password");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Password</h3>
                <p className="text-sm text-muted-foreground">
                    Change your password here. After changing, you will be logged out.
                </p>
            </div>
            <Separator />

            <form onSubmit={handleSubmit} className="space-y-8 max-w-xl">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="oldPassword">Current Password</Label>
                        <Input
                            id="oldPassword"
                            type="password"
                            value={formData.oldPassword}
                            onChange={(e) =>
                                setFormData({ ...formData, oldPassword: e.target.value })
                            }
                            placeholder="Enter current password"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) =>
                                setFormData({ ...formData, newPassword: e.target.value })
                            }
                            placeholder="Enter new password"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) =>
                                setFormData({ ...formData, confirmPassword: e.target.value })
                            }
                            placeholder="Confirm new password"
                            required
                        />
                    </div>
                </div>

                <div className="flex justify-start">
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Change Password
                    </Button>
                </div>
            </form>
        </div>
    );
}
