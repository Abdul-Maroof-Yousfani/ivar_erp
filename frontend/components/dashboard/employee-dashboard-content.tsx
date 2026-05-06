"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    CalendarDays,
    Clock,
    FileText,
    Coffee,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Home,
    User,
    GraduationCap,
    History,
    ScrollText,
    Briefcase,
    TrendingUp,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { dashboardApi, EmployeeDashboardStats, employeeApi, Employee } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoContent } from "./profile/info-content";
import { EducationContent } from "./profile/education-content";
import { PoliciesContent } from "./profile/policies-content";
import { HistoryContent } from "./profile/history-content";
import { LeavesContent } from "./profile/leaves-content";
import { WorkExperienceContent } from "./profile/work-experience-content";
import { PerformanceContent } from "./profile/performance-content";
import { authFetch } from "@/lib/auth";

export function EmployeeDashboardContent() {
    const { user } = useAuth();
    const [stats, setStats] = useState<EmployeeDashboardStats | null>(null);
    const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            if (!user) return;

            try {
                // Fetch stats and profile in parallel
                const statsPromise = dashboardApi.getEmployeeStats(authFetch);
                const profilePromise = user.employee?.id
                    ? employeeApi.getProfile(user.employee.id, true)
                    : Promise.resolve({ status: false, data: null });

                const [statsData, profileRes] = await Promise.all([
                    statsPromise,
                    profilePromise
                ]);

                setStats(statsData);
                if (profileRes.status && profileRes.data) {
                    setEmployeeProfile(profileRes.data);
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [user]);

    if (loading) {
        return <DashboardSkeleton />;
    }

    if (error || !stats) {
        return (
            <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="mt-4 text-lg font-semibold">{error || "No data available"}</h3>
                    <p className="mb-4 mt-2 text-sm text-muted-foreground">
                        We couldn't load your dashboard information. Please try refreshing the page.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="outline">
                        Reload Page
                    </Button>
                </div>
            </div>
        );
    }

    const currentDate = new Date();
    const greeting = currentDate.getHours() < 12 ? "Good Morning" : currentDate.getHours() < 18 ? "Good Afternoon" : "Good Evening";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-gray-100 dark:to-gray-400">
                        {greeting}, {user?.firstName}
                    </h2>
                    <p className="text-muted-foreground">
                        Here's what's happening with you today.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
                        {format(currentDate, "EEEE, MMMM do, yyyy")}
                    </span>
                </div>
            </div>

            <Tabs defaultValue="home" className="w-full space-y-6">
                <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    <TabsList variant="underline" className="w-full justify-start h-auto p-0 bg-transparent border-b">
                        <TabsTrigger value="home" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <Home className="h-4 w-4 mr-2" />
                            Home
                        </TabsTrigger>
                        <TabsTrigger value="info" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <User className="h-4 w-4 mr-2" />
                            Info Profile
                        </TabsTrigger>
                        <TabsTrigger value="leaves" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <Coffee className="h-4 w-4 mr-2" />
                            Leaves
                        </TabsTrigger>
                        <TabsTrigger value="education" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <GraduationCap className="h-4 w-4 mr-2" />
                            Education
                        </TabsTrigger>
                        <TabsTrigger value="experience" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <Briefcase className="h-4 w-4 mr-2" />
                            Work Experience
                        </TabsTrigger>
                        <TabsTrigger value="history" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <History className="h-4 w-4 mr-2" />
                            History
                        </TabsTrigger>
                        <TabsTrigger value="policies" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <ScrollText className="h-4 w-4 mr-2" />
                            Policies
                        </TabsTrigger>
                        <TabsTrigger value="performance" variant="underline" className="data-[state=active]:text-primary data-[state=active]:border-primary pb-3 rounded-none">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Performance
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="home" className="space-y-6 mt-6">
                    {/* Main Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <StatsCard
                            title="Attendance"
                            value={`${stats.overview.presentMonth}/${stats.overview.presentMonth + stats.overview.absentMonth} Days`}
                            icon={CalendarDays}
                            description="Present this month"
                            trend="neutral"
                            className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800"
                            iconColor="text-green-600 dark:text-green-400"
                        />
                        <StatsCard
                            title="Late Arrivals"
                            value={stats.overview.lateMonth}
                            icon={Clock}
                            description="Times late this month"
                            trend={stats.overview.lateMonth > 2 ? "negative" : "positive"}
                            className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800"
                            iconColor="text-orange-600 dark:text-orange-400"
                        />
                        <StatsCard
                            title="Leave Status"
                            value={stats.overview.pendingLeaves}
                            icon={FileText}
                            description="Pending applications"
                            trend="neutral"
                            className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800"
                            iconColor="text-blue-600 dark:text-blue-400"
                        />
                        <StatsCard
                            title="Next Holiday"
                            value={stats.upcomingHoliday ? format(new Date(stats.upcomingHoliday.dateFrom), "MMM dd") : "None"}
                            icon={Coffee}
                            description={stats.upcomingHoliday?.name || "No upcoming holidays"}
                            trend="neutral"
                            className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800"
                            iconColor="text-purple-600 dark:text-purple-400"
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        {/* Recent Activity / Attendance Log */}
                        <Card className="col-span-4 transition-all hover:shadow-md border-muted/60">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    Recent Attendance
                                </CardTitle>
                                <CardDescription>
                                    Your last 5 check-ins and check-outs
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {stats.recentActivities.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No recent activity found.
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {stats.recentActivities.map((activity, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-muted/50 transition-colors hover:bg-muted/50"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "flex h-9 w-9 items-center justify-center rounded-full border",
                                                        activity.status === "present" ? "bg-green-100 border-green-200 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" :
                                                            activity.status === "absent" ? "bg-red-100 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400" :
                                                                "bg-yellow-100 border-yellow-200 text-yellow-600 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400"
                                                    )}>
                                                        {activity.status === "present" ? <CheckCircle2 className="h-5 w-5" /> :
                                                            activity.status === "absent" ? <XCircle className="h-5 w-5" /> :
                                                                <Clock className="h-5 w-5" />}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium leading-none">
                                                            {format(new Date(activity.date), "EEEE, MMM do")}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground capitalize">
                                                            {activity.status}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right space-y-1">
                                                    <div className="text-sm font-medium">
                                                        {activity.checkIn ? format(new Date(activity.checkIn), "hh:mm a") : "--:--"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Out: {activity.checkOut ? format(new Date(activity.checkOut), "hh:mm a") : "--:--"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <div className="col-span-3 space-y-4">
                            <Card className="transition-all hover:shadow-md border-muted/60 h-full">
                                <CardHeader>
                                    <CardTitle>Quick Actions</CardTitle>
                                    <CardDescription>Common tasks you might want to do</CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-3">
                                    <Button asChild variant="outline" className="w-full justify-start h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all group">
                                        <Link href="/hr/leaves/create-leaves">
                                            <div className="bg-blue-100 p-2 rounded-md mr-3 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:scale-105 transition-transform">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">Apply for Leave</div>
                                                <div className="text-xs text-muted-foreground">Request time off</div>
                                            </div>
                                        </Link>
                                    </Button>

                                    <Button asChild variant="outline" className="w-full justify-start h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all group">
                                        <Link href="/hr/attendance/summary">
                                            <div className="bg-green-100 p-2 rounded-md mr-3 text-green-600 dark:bg-green-900/20 dark:text-green-400 group-hover:scale-105 transition-transform">
                                                <CalendarDays className="h-4 w-4" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">My Attendance</div>
                                                <div className="text-xs text-muted-foreground">View your history</div>
                                            </div>
                                        </Link>
                                    </Button>

                                    <Button asChild variant="outline" className="w-full justify-start h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all group">
                                        <Link href="/hr/payroll-setup/payroll/payslips">
                                            <div className="bg-purple-100 p-2 rounded-md mr-3 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 group-hover:scale-105 transition-transform">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">My Payslips</div>
                                                <div className="text-xs text-muted-foreground">View salary details</div>
                                            </div>
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="info">
                    <InfoContent employee={employeeProfile} />
                </TabsContent>

                <TabsContent value="leaves">
                    <LeavesContent employee={employeeProfile} />
                </TabsContent>

                <TabsContent value="education">
                    <EducationContent employee={employeeProfile} />
                </TabsContent>

                <TabsContent value="experience">
                    <WorkExperienceContent employee={employeeProfile} />
                </TabsContent>

                <TabsContent value="history">
                    <HistoryContent employee={employeeProfile} />
                </TabsContent>

                <TabsContent value="policies">
                    <PoliciesContent employee={employeeProfile} />
                </TabsContent>

                <TabsContent value="performance" className="mt-6">
                    <PerformanceContent employeeId={user?.employee?.id} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function StatsCard({
    title,
    value,
    icon: Icon,
    description,
    trend,
    className,
    iconColor
}: {
    title: string,
    value: string | number,
    icon: any,
    description: string,
    trend: "positive" | "negative" | "neutral",
    className?: string,
    iconColor?: string
}) {
    return (
        <Card className={cn("overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className={cn("p-2 rounded-full bg-white/50 dark:bg-black/20", iconColor)}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                    {description}
                </p>
            </CardContent>
        </Card>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-32 rounded-full" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Skeleton className="col-span-4 h-[400px]" />
                <Skeleton className="col-span-3 h-[400px]" />
            </div>
        </div>
    );
}
