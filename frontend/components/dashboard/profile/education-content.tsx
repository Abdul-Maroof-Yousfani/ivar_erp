"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Employee } from "@/lib/api";
import { GraduationCap, School } from "lucide-react";
import { format } from "date-fns";

interface EducationContentProps {
    employee: Employee | null;
}

export function EducationContent({ employee }: EducationContentProps) {
    if (!employee) {
        return <div className="text-muted-foreground">Loading education information...</div>;
    }
  const qualifications = employee.qualifications || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Education & Qualifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qualifications.length > 0 ? (
            <div className="space-y-6">
              {qualifications.map((qual) => (
                <div key={qual.id} className="flex flex-col space-y-2 border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-lg">{qual.degree}</h4>
                      <div className="flex items-center text-muted-foreground">
                        <School className="mr-2 h-4 w-4" />
                        <span>{qual.institution}</span>
                      </div>
                    </div>
                    {qual.passingYear && (
                      <div className="text-sm font-medium bg-secondary px-2 py-1 rounded">
                        {qual.passingYear}
                      </div>
                    )}
                  </div>
                  {qual.gradeOrDivision && (
                    <div className="text-sm">
                      <span className="font-medium">Grade/Division:</span> {qual.gradeOrDivision}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No education details available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
