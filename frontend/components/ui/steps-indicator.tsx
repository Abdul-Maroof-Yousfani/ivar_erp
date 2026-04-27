import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepsProps {
    steps: string[];
    currentStep: number;
}

export function Steps({ steps, currentStep }: StepsProps) {
    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <div key={step} className="flex flex-col items-center relative w-full">
                            {/* Line connector */}
                            {index !== 0 && (
                                <div
                                    className={cn(
                                        "absolute top-4 right-[50%] w-full h-[2px]",
                                        isCompleted ? "bg-primary" : "bg-muted"
                                    )}
                                />
                            )}

                            <div
                                className={cn(
                                    "z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 bg-background",
                                    isCompleted
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : isCurrent
                                            ? "border-primary text-primary"
                                            : "border-muted text-muted-foreground"
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <span className="text-sm font-medium">{index + 1}</span>
                                )}
                            </div>
                            <span
                                className={cn(
                                    "mt-2 text-xs font-medium uppercase tracking-wider",
                                    isCurrent ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                {step}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
