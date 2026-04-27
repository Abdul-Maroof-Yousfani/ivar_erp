import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "@/lib/api";
import { format } from "date-fns";
import { Briefcase } from "lucide-react";

interface WorkExperienceContentProps {
    employee: Employee | null;
}

export function WorkExperienceContent({ employee }: WorkExperienceContentProps) {
    if (!employee) {
        return <div className="text-muted-foreground">Loading work experience information...</div>;
    }
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Work Experience
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No external work experience records found.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
