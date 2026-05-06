'use client';

import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TimePicker } from '@/components/ui/time-picker';
import { PauseCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addHours, addMinutes, setHours, setMinutes } from 'date-fns';

interface HoldOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (holdUntil: string) => Promise<void>;
    isHolding?: boolean;
    itemCount?: number;
}

const QUICK_DURATIONS = [
    { label: '1 min', minutes: 1 },
    { label: '30 min', minutes: 30 },
    { label: '1 hr', minutes: 60 },
    { label: '2 hrs', minutes: 120 },
    { label: '5 hrs', minutes: 300 },
];

function getMaxTime(): string {
    return '23:59';
}

function clampToMax(timeStr: string): string {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    // Max is 23:59 (midnight not selectable)
    if (h > 23 || (h === 23 && m > 59)) return '23:59';
    return timeStr;
}

export function HoldOrderModal({ open, onOpenChange, onConfirm, isHolding, itemCount }: HoldOrderModalProps) {
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [activeQuick, setActiveQuick] = useState<number | null>(null);

    const handleQuickDuration = (minutes: number) => {
        const now = new Date();
        const target = addMinutes(now, minutes);
        const h = target.getHours();
        const m = target.getMinutes();
        // Cap at 23:59
        if (h > 23 || (h === 23 && m > 59)) {
            setSelectedTime('23:59');
        } else {
            setSelectedTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
        setActiveQuick(minutes);
    };

    const handleTimeChange = (val: string) => {
        const clamped = clampToMax(val);
        setSelectedTime(clamped);
        setActiveQuick(null);
    };

    const handleConfirm = async () => {
        if (!selectedTime) return;
        await onConfirm(selectedTime);
        setSelectedTime('');
        setActiveQuick(null);
    };

    const handleClose = (v: boolean) => {
        if (!v) {
            setSelectedTime('');
            setActiveQuick(null);
        }
        onOpenChange(v);
    };

    // Preview label
    const previewLabel = selectedTime
        ? (() => {
            const [h, m] = selectedTime.split(':').map(Number);
            const target = new Date();
            target.setHours(h, m, 0, 0);
            const diffMs = target.getTime() - Date.now();
            if (diffMs <= 0) return 'Time already passed — pick a future time';
            const diffMins = Math.round(diffMs / 60000);
            if (diffMins < 60) return `Holds for ~${diffMins} min (until ${selectedTime})`;
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            return `Holds for ~${hrs}h ${mins > 0 ? `${mins}m` : ''} (until ${selectedTime})`;
        })()
        : null;

    const isTimeInPast = selectedTime
        ? (() => {
            const [h, m] = selectedTime.split(':').map(Number);
            const target = new Date();
            target.setHours(h, m, 0, 0);
            return target.getTime() <= Date.now();
        })()
        : false;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[380px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PauseCircle className="h-5 w-5 text-amber-500" />
                        Hold Order
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {itemCount !== undefined && (
                        <p className="text-sm text-muted-foreground">
                            Holding <span className="font-semibold text-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>. Select how long to hold.
                        </p>
                    )}

                    {/* Quick durations */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quick Duration</Label>
                        <div className="grid grid-cols-5 gap-2">
                            {QUICK_DURATIONS.map(({ label, minutes }) => (
                                <Button
                                    key={minutes}
                                    type="button"
                                    variant={activeQuick === minutes ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn('h-9 text-xs font-semibold', activeQuick === minutes && 'shadow-md')}
                                    onClick={() => handleQuickDuration(minutes)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Custom time picker */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                            Hold Until (max 11:59 PM)
                        </Label>
                        <TimePicker
                            value={selectedTime}
                            onChange={handleTimeChange}
                            placeholder="Select time"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            Time after midnight (12:00 AM+) is not selectable. Orders auto-expire at midnight.
                        </p>
                    </div>

                    {/* Preview */}
                    {previewLabel && (
                        <div className={cn(
                            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                            isTimeInPast
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                        )}>
                            <Clock className="h-4 w-4 shrink-0" />
                            {previewLabel}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => handleClose(false)} disabled={isHolding}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedTime || isTimeInPast || isHolding}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                    >
                        {isHolding
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Holding...</>
                            : <><PauseCircle className="h-4 w-4 mr-2" /> Hold Order</>
                        }
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
