"use client";

import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";

interface PolicyAssignment {
    id: string;
    startDate: string | Date;
    endDate: string | Date;
    workingHoursPolicy?: {
        id: string;
        name: string;
        workingHoursPerDay?: number;
    };
}

interface PolicyTimelineProps {
    assignments: PolicyAssignment[];
    defaultPolicy?: {
        id: string;
        name: string;
        workingHoursPerDay?: number;
    };
    monthYear: string; // Format: "YYYY-MM"
}

export function PolicyTimeline({ assignments, defaultPolicy, monthYear }: PolicyTimelineProps) {
    if (!assignments || assignments.length === 0) {
        if (!defaultPolicy) return null;

        return (
            <div className="flex items-center gap-2 text-[10px]">
                <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="font-bold shrink-0">Policy:</span>
                <span>{defaultPolicy.name}</span>
                {defaultPolicy.workingHoursPerDay && (
                    <span className="text-muted-foreground">({defaultPolicy.workingHoursPerDay}h/day)</span>
                )}
            </div>
        );
    }

    // Parse month year to get start and end dates
    const [year, month] = monthYear.split("-");
    const monthStart = new Date(Number(year), Number(month) - 1, 1);
    const monthEnd = new Date(Number(year), Number(month), 0);
    const totalDays = monthEnd.getDate();

    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-bold">
                <Calendar className="h-2.5 w-2.5" />
                <span>Working Hour Policy Timeline</span>
            </div>

            {/* Timeline visualization */}
            <div className="relative">
                <div className="flex gap-0 h-4 rounded border border-gray-200 overflow-hidden bg-white">
                    {assignments.map((assignment, idx) => {
                        const start = new Date(assignment.startDate);
                        const end = new Date(assignment.endDate);

                        // Clamp to month boundaries
                        const effectiveStart = start < monthStart ? monthStart : start;
                        const effectiveEnd = end > monthEnd ? monthEnd : end;

                        // Calculate days in this segment
                        const startDay = effectiveStart.getDate();
                        const endDay = effectiveEnd.getDate();
                        const daysInSegment = endDay - startDay + 1;

                        // Calculate percentage width
                        const widthPercent = (daysInSegment / totalDays) * 100;

                        const policy = assignment.workingHoursPolicy || defaultPolicy;

                        // Subtle alternating pattern matching table theme
                        const isEven = idx % 2 === 0;
                        const colorClass = isEven
                            ? "bg-gray-50 border-r border-gray-200"
                            : "bg-white border-r border-gray-200";

                        return (
                            <div
                                key={assignment.id}
                                className={`${colorClass} relative group cursor-help flex items-center justify-center`}
                                style={{ width: `${widthPercent}%` }}
                                title={`${policy?.name || 'Unknown'}: ${format(effectiveStart, 'MMM d')} - ${format(effectiveEnd, 'MMM d')}`}
                            >
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max">
                                    <div className="bg-popover text-popover-foreground text-[10px] rounded-md shadow-lg border p-2">
                                        <div className="font-bold">{policy?.name || 'Unknown Policy'}</div>
                                        <div className="text-muted-foreground">
                                            {format(effectiveStart, 'MMM d')} - {format(effectiveEnd, 'MMM d')}
                                        </div>
                                        {policy?.workingHoursPerDay && (
                                            <div className="text-muted-foreground">
                                                {policy.workingHoursPerDay}h/day
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 mt-1">
                    {assignments.map((assignment, idx) => {
                        const policy = assignment.workingHoursPolicy || defaultPolicy;
                        const isEven = idx % 2 === 0;

                        return (
                            <div key={assignment.id} className="flex items-center gap-1.5 text-[10px]">
                                <div className={`w-2 h-2 rounded-sm ${isEven ? 'bg-gray-400' : 'bg-gray-300'} border border-gray-400`} />
                                <span className="font-bold">{policy?.name || 'Unknown'}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
