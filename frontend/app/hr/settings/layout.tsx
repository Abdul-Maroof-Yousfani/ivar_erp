"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Shield, Laptop } from "lucide-react";

interface SettingsLayoutProps {
    children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();

    const tabs = [
        {
            title: "Profile",
            href: "/hr/settings/profile",
            icon: User,
        },
        {
            title: "Security",
            href: "/hr/settings/password",
            icon: Shield,
        },
        {
            title: "Sessions",
            href: "/hr/settings/sessions",
            icon: Laptop,
        }
    ];

    return (
        <div className="container max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="lg:w-64 shrink-0 lg:sticky lg:top-24 self-start">
                    <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 overflow-x-auto pb-4 lg:pb-0">
                        {tabs.map((item) => (
                            <Button
                                key={item.href}
                                variant={pathname === item.href ? "secondary" : "ghost"}
                                className={cn(
                                    "justify-start whitespace-nowrap",
                                    pathname === item.href && "bg-secondary font-medium shadow-sm"
                                )}
                                onClick={() => router.push(item.href)}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.title}
                            </Button>
                        ))}
                    </nav>
                </aside>
                <div className="flex-1 min-w-0 bg-card rounded-lg border shadow-sm p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
