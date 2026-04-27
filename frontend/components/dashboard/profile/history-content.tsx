import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "@/lib/api";
import { format } from "date-fns";
import { History } from "lucide-react";

interface HistoryContentProps {
    employee: Employee | null;
}

export function HistoryContent({ employee }: HistoryContentProps) {
    if (!employee) {
        return <div className="text-muted-foreground">Loading history information...</div>;
    }
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Employment History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                                <p className="font-medium capitalize">{employee.status}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Joining Date</p>
                                <p className="font-medium">
                                    {employee.joiningDate ? format(new Date(employee.joiningDate), "PPP") : "N/A"}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                                <p className="font-medium">
                                    {employee.updatedAt ? format(new Date(employee.updatedAt), "PPP") : "N/A"}
                                </p>
                            </div>
                        </div>
                        
                        {/* If we had rejoining history, we would map it here. 
                            For now, we just show current status summary. 
                        */}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
