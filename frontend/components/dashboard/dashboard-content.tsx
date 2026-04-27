"use client";

import { useEffect, useState } from "react";
import {
    Users,
    Clock,
    AlertCircle,
    FileText,
    CheckCircle,
    XCircle,
    Gift,
    Cake,
    Calendar,
    TrendingUp,
    Zap,
    BarChart3,
    Lightbulb,
    ShieldAlert,
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    UserPlus,
    History,
    FileSpreadsheet,
    Settings,
    Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { dashboardApi, DashboardStats } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/components/providers/company-provider";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Line, LineChart as ReLineChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "../ui/scroll-area";

export function DashboardContent() {
    const { currentCompany, loading: companyLoading } = useCompany();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);

    useEffect(() => {
        if (companyLoading || !currentCompany) return;

        async function loadStats() {
            try {
                setLoading(true);
                const data = await dashboardApi.getStats();
                setStats(data);
                setError(null);
            } catch (err) {
                console.error(err);
                setError("Failed to load dashboard data.");
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, [currentCompany, companyLoading]);

    if (companyLoading || loading) {
        return <DashboardSkeleton />;
    }

    if (!currentCompany) {
        return <div className="p-4 text-amber-600 bg-amber-50 rounded-md">Please select a company to view dashboard data.</div>;
    }

    if (error || !stats) {
        return (
            <div className="p-4 text-red-500 bg-red-50 rounded-md flex flex-col gap-2">
                <p>{error || "No data available"}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-sm underline text-left"
                >
                    Retry
                </button>
            </div>
        );
    }

    const attendanceData = [
        { name: "Present", value: stats.overview.presentToday.value, color: "#22c55e" },
        { name: "Absent", value: stats.overview.absentToday.value, color: "#ef4444" },
    ];

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Dashboard Overview
                </h2>
                <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Employees"
                    value={stats.overview.totalEmployees.value}
                    icon={Users}
                    description={`${stats.overview.inactiveEmployees.value} inactive accounts`}
                    trend={stats.overview.totalEmployees.trend !== 0 ? `${Math.abs(stats.overview.totalEmployees.trend || 0)}%` : undefined}
                    trendType={stats.overview.totalEmployees.trendType}
                />
                <StatsCard
                    title="Presence Today"
                    value={stats.overview.presentToday.value}
                    icon={CheckCircle}
                    description="Employees checked in"
                    trend={stats.overview.presentToday.trend !== 0 ? `${Math.abs(stats.overview.presentToday.trend || 0)}%` : undefined}
                    trendType={stats.overview.presentToday.trendType}
                />
                <StatsCard
                    title="Pending Leaves"
                    value={stats.overview.pendingLeaves.value}
                    icon={FileText}
                    description="Awaiting HR approval"
                    highlight={stats.overview.pendingLeaves.value > 5}
                    trend={stats.overview.pendingLeaves.trend !== 0 ? `${Math.abs(stats.overview.pendingLeaves.trend || 0)}%` : undefined}
                    trendType={stats.overview.pendingLeaves.trendType}
                />
                <StatsCard
                    title="Attendance Queries"
                    value={stats.overview.pendingAttendanceQueries.value}
                    icon={AlertCircle}
                    description="Open regularization requests"
                    highlight={stats.overview.pendingAttendanceQueries.value > 0}
                    trend={stats.overview.pendingAttendanceQueries.trend !== 0 ? `${Math.abs(stats.overview.pendingAttendanceQueries.trend || 0)}%` : undefined}
                    trendType={stats.overview.pendingAttendanceQueries.trendType}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-12">
                {/* Main Analytics Section */}
                <div className="md:col-span-8 space-y-6">
                    {/* Attendance Trend (NEW) */}
                    <Card className="transition-all hover:shadow-lg border-border/50 overflow-hidden min-h-[400px]">
                        <CardHeader className="pb-2 bg-muted/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base font-bold">Attendance Trend</CardTitle>
                                        <CardDescription>Presence logs for last 14 days</CardDescription>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ChartContainer config={{
                                present: { label: "Present", color: "#22c55e" },
                                absent: { label: "Absent", color: "#ef4444" }
                            }} className="h-[280px] w-full">
                                <ReLineChart data={stats.attendanceTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        fontSize={10}
                                        fontWeight={500}
                                        dy={10}
                                    />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={500} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Line
                                        type="monotone"
                                        dataKey="present"
                                        stroke="#22c55e"
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="absent"
                                        stroke="#ef4444"
                                        strokeWidth={3}
                                        dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                    />
                                </ReLineChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    {/* Department Distribution Chart */}
                    <Card className="transition-all hover:shadow-lg border-border/50 min-h-[400px]">
                        <CardHeader className="bg-muted/10">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary" />
                                Department Distribution
                            </CardTitle>
                            <CardDescription>Employee count per department</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ChartContainer config={{ count: { label: "Employees", color: "var(--primary)" } }} className="h-[280px] w-full">
                                <BarChart data={stats.departmentStats}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} interval={0} angle={-90} textAnchor="end" height={60} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    {/* Recent Leave Requests Table (NEW) */}
                    <Card className="border-border/50 shadow-sm overflow-hidden min-h-[400px] gap-0">
                        <CardHeader className="bg-muted/5 border-b">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    <CardTitle className="text-lg font-bold">Recent Leave Requests</CardTitle>
                                </div>
                                <button className="text-xs font-bold text-primary hover:underline group flex items-center gap-1">
                                    View All Requests <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/30 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                                        <tr>
                                            <th className="px-6 py-4">Employee</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Period</th>
                                            <th className="px-6 py-4">Days</th>
                                            <th className="px-6 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {stats.recentLeaveRequests?.length ? stats.recentLeaveRequests.map((leave, idx) => (
                                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-bold text-sm leading-tight">{leave.employeeName}</p>
                                                        <p className="text-[10px] text-muted-foreground">{leave.department}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="text-[10px] font-bold uppercase">{leave.type}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-medium">
                                                    {new Date(leave.dateFrom).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} - {new Date(leave.dateTo).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold">{leave.days}</td>
                                                <td className="px-6 py-4">
                                                    <Badge className={cn(
                                                        "text-[10px] font-black uppercase",
                                                        leave.status === 'approved' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                                                            leave.status === 'rejected' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                                "bg-amber-100 text-amber-700 hover:bg-amber-100"
                                                    )}>
                                                        {leave.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic text-xs">
                                                    No recent leave applications found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Insights & Suggestions Section (NEW) */}
                    {stats.analyticsSuggestions && stats.analyticsSuggestions.length > 0 && (
                        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 gap-2">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-primary animate-pulse" />
                                        <CardTitle className="text-lg font-bold">Smart Insights & Suggestions</CardTitle>
                                    </div>
                                    <CardDescription>Data-driven recommendations based on recent patterns</CardDescription>
                                </div>
                                <Badge variant="secondary" className="bg-primary/10 text-primary font-bold">BETA</Badge>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                                {stats.analyticsSuggestions.map((suggestion, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-all group"
                                    >
                                        <div className={cn(
                                            "mt-1 p-2 rounded-md transition-colors",
                                            suggestion.impact === 'high' ? "bg-red-50 text-red-600" :
                                                suggestion.impact === 'medium' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                                        )}>
                                            <Lightbulb className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{suggestion.title}</h4>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                {suggestion.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] font-bold uppercase tracking-tighter",
                                                    suggestion.impact === 'high' ? "border-red-200 text-red-600 bg-red-50/50" :
                                                        suggestion.impact === 'medium' ? "border-amber-200 text-amber-600 bg-amber-50/50" : "border-blue-200 text-blue-600 bg-blue-50/50"
                                                )}
                                            >
                                                {suggestion.impact} Impact
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Sidebar */}
                <div className="md:col-span-4 space-y-6">
                    {/* Critical Alerts Card (NEW) */}
                    {
                        stats.criticalAlerts && stats.criticalAlerts.length > 0 && (
                            <Card className="border-red-500/10 shadow-sm overflow-hidden py-0 gap-0">
                                <CardHeader className="bg-red-500/5 pb-3 pt-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="h-5 w-5 text-red-500" />
                                        <CardTitle className="text-base font-bold text-red-700">Critical Alerts</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-red-100/50">
                                        {stats.criticalAlerts.slice(0, 3).map((alert, idx) => (
                                            <div key={idx} className="flex gap-3 p-4 items-start hover:bg-muted/30 transition-colors">
                                                <div className={cn(
                                                    "mt-1 w-2 h-2 rounded-full shrink-0",
                                                    alert.priority === 'high' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                                                )} />
                                                <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                                <CardFooter className="p-0 bg-muted/10 border-t flex justify-center pb-6 !pt-4">
                                    <Dialog open={isAlertsModalOpen} onOpenChange={setIsAlertsModalOpen}>
                                        <DialogTrigger asChild>
                                            <button className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
                                                View All Management <ChevronRight className="h-3 w-3" />
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <ShieldAlert className="h-5 w-5 text-red-500" />
                                                    Critical Alerts Management
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Review and take action on high-priority administrative tasks.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4 space-y-4">
                                                <div className="rounded-md border">
                                                    <div className="divide-y">
                                                        {stats.criticalAlerts.map((alert, idx) => (
                                                            <div key={idx} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                                                                <div className={cn(
                                                                    "mt-1.5 w-2 h-2 rounded-full shrink-0",
                                                                    alert.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'
                                                                )} />
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-bold">{alert.message}</p>
                                                                    <div className="flex items-center gap-4 mt-2">
                                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                                                                            {alert.type.replace('_', ' ')}
                                                                        </Badge>
                                                                        <button className="text-[10px] text-primary font-bold uppercase hover:underline">
                                                                            View Employee Profile
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <Badge variant={alert.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px] font-black uppercase">
                                                                    {alert.priority}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </CardFooter>
                            </Card>
                        )
                    }

                    {/* Today's Attendance Pie Chart */}
                    <Card className="transition-all hover:shadow-md border-border/50 gap-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold">Live Attendance</CardTitle>
                            <CardDescription>Real-time status for today</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-4 flex flex-col items-center">
                                {attendanceData.every(d => d.value === 0) ? (
                                    <div className="h-[200px] w-full flex items-center justify-center bg-muted/20 rounded-xl border-2 border-dashed border-border/50">
                                        <p className="text-muted-foreground text-sm font-medium">No activity today</p>
                                    </div>
                                ) : (
                                    <ChartContainer config={{
                                        present: { label: "Present", color: "#22c55e" },
                                        absent: { label: "Absent", color: "#ef4444" }
                                    }} className="h-[220px] w-full">
                                        <PieChart>
                                            <Pie
                                                data={attendanceData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={65}
                                                outerRadius={85}
                                                paddingAngle={2}
                                                dataKey="value"
                                                strokeWidth={0}
                                            >
                                                {attendanceData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                        </PieChart>
                                    </ChartContainer>
                                )}

                                <div className="grid grid-cols-2 gap-4 w-full mt-6">
                                    <div className="bg-green-50/50 p-3 rounded-xl dark:bg-green-900/50 text-center">
                                        <p className="text-[10px] font-bold uppercase text-green-700/60 dark:text-green-200/60 tracking-wider">Present</p>
                                        <p className="text-xl font-black text-green-700 dark:text-green-200">{stats.overview.presentToday.value}</p>
                                    </div>
                                    <div className="bg-red-50/50 p-3 rounded-xl dark:bg-red-900/50 text-center">
                                        <p className="text-[10px] font-bold uppercase text-red-700/60 dark:text-red-200/60 tracking-wider">Absent</p>
                                        <p className="text-xl font-black text-red-700 dark:text-red-200">{stats.overview.absentToday.value}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>



                    {/* Celebrations Card (NEW) */}
                    <Card className="transition-all hover:shadow-md border-border/50 overflow-hidden py-0 gap-0">
                        <CardHeader className="pb-3 bg-muted/20 pt-5">
                            <div className="flex items-center gap-2">
                                <Gift className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg font-bold">Upcoming Celebrations</CardTitle>
                            </div>
                        </CardHeader>
                        <Tabs defaultValue="birthdays" className="w-full shadow-none border-0 gap-0">
                            <TabsList className="w-full grid grid-cols-2 rounded-none bg-muted/40 p-1">
                                <TabsTrigger value="birthdays" className="text-xs font-bold gap-2">
                                    <Cake className="h-3.5 w-3.5" /> Birthdays
                                </TabsTrigger>
                                <TabsTrigger value="anniversaries" className="text-xs font-bold gap-2">
                                    <Calendar className="h-3.5 w-3.5" /> Anniversaries
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value="birthdays" className="m-0">
                                <ScrollArea className="h-[300px]" showShadows>
                                    {stats.upcomingBirthdays?.length ? (
                                        <div className="divide-y divide-border/30">
                                            {stats.upcomingBirthdays.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group">
                                                    <Avatar className="h-9 w-9 border-2 border-primary/20 group-hover:border-primary transition-all">
                                                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                                                            {item.name.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold truncate leading-tight">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{item.department}</p>
                                                    </div>
                                                    <div className="bg-primary/5 px-2 py-1 rounded-md text-center shrink-0 min-w-[50px]">
                                                        <p className="text-[10px] font-black text-primary uppercase">
                                                            {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="p-8 text-center text-xs text-muted-foreground italic">No birthdays this month</p>
                                    )}</ScrollArea>
                            </TabsContent>
                            <TabsContent value="anniversaries" className="m-0">
                                <ScrollArea className="h-[300px]" showShadows>
                                    {stats.upcomingAnniversaries?.length ? (
                                        <div className="divide-y divide-border/30">
                                            {stats.upcomingAnniversaries.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group">
                                                    <div className="h-9 w-9 rounded-full bg-amber-50 flex items-center justify-center border-2 border-amber-200 group-hover:bg-amber-100 transition-all shrink-0">
                                                        <span className="text-amber-700 text-xs font-black">{item.years}y</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold truncate leading-tight">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{item.department}</p>
                                                    </div>
                                                    <div className="bg-amber-50 px-2 py-1 rounded-md text-center shrink-0 min-w-[50px]">
                                                        <p className="text-[10px] font-black text-amber-600 uppercase">
                                                            {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="p-8 text-center text-xs text-muted-foreground italic">No anniversaries this month</p>
                                    )}</ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </div >
            </div >
        </div >
    );
}

function StatsCard({
    title,
    value,
    icon: Icon,
    description,
    trend,
    trendType,
    highlight
}: {
    title: string,
    value: number,
    icon: any,
    description: string,
    trend?: string,
    trendType?: 'up' | 'down',
    highlight?: boolean
}) {
    return (
        <Card className={cn(
            "group relative overflow-hidden transition-all duration-300 hover:border-primary/30",
            highlight && "border-primary/50 bg-primary/5"
        )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">
                    {title}
                </CardTitle>
                <div className={cn(
                    "p-2 rounded-lg transition-all duration-300 group-hover:scale-110",
                    highlight ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-black tracking-tight">{value}</div>
                    {trend && (
                        <div className={cn(
                            "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            trendType === 'up' ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                        )}>
                            {trendType === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {trend}
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-none opacity-80">
                    {description}
                </p>
            </CardContent>
            {/* Glossy overlay effect on hover */}
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </Card>
    );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex flex-col gap-1">
                <Skeleton className="h-9 w-[250px]" />
                <Skeleton className="h-4 w-[350px]" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-6 md:grid-cols-12">
                <div className="md:col-span-8 space-y-6">
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                    <Skeleton className="h-[350px] w-full rounded-xl" />
                </div>
                <div className="md:col-span-4 space-y-6">
                    <Skeleton className="h-[150px] w-full rounded-xl" />
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                    <Skeleton className="h-[300px] w-full rounded-xl" />
                </div>
            </div>
        </div>
    );
}
