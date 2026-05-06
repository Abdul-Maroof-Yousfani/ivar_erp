"use client";

import { Employee } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Phone, Mail, MapPin, Building, Calendar, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface InfoContentProps {
  employee: Employee | null;
}

export function InfoContent({ employee }: InfoContentProps) {
  if (!employee) {
    return <div className="text-muted-foreground">Loading profile information...</div>;
  }
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "dd MMM yyyy");
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center justify-center p-6 bg-card rounded-lg border shadow-sm space-y-4">
        <div className="relative">
          <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
            <AvatarImage src={employee.avatarUrl || ""} alt={employee.employeeName} className="object-cover" />
            <AvatarFallback className="text-4xl bg-primary/10 text-primary">
              {employee.employeeName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {employee.employeeName}
          </h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <span className="font-medium">{employee.designationRelation?.name || "N/A"}</span>
            {employee.departmentRelation?.name && (
              <>
                <span className="text-muted-foreground/40">|</span>
                <span>{employee.departmentRelation.name}</span>
              </>
            )}
          </div>
          {employee.officialEmail && (
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {employee.officialEmail}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
      {/* Personal Information */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium text-muted-foreground">Full Name</div>
            <div className="text-sm">{employee.employeeName}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Father/Husband Name</div>
            <div className="text-sm">{employee.fatherHusbandName || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Date of Birth</div>
            <div className="text-sm">{formatDate(employee.dateOfBirth)}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Gender</div>
            <div className="text-sm capitalize">{employee.gender || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Marital Status</div>
            <div className="text-sm">{employee.maritalStatusRelation?.name || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Nationality</div>
            <div className="text-sm">{employee.nationality || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">CNIC</div>
            <div className="text-sm">{employee.cnicNumber || "N/A"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Contact Number</div>
                <div className="text-sm text-muted-foreground">{employee.contactNumber || "N/A"}</div>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Emails</div>
                <div className="text-sm text-muted-foreground">
                  <div>Personal: {employee.personalEmail || "N/A"}</div>
                  <div>Official: {employee.officialEmail || "N/A"}</div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Current Address</div>
                <div className="text-sm text-muted-foreground">{employee.currentAddress || "N/A"}</div>
              </div>
            </div>
             <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Permanent Address</div>
                <div className="text-sm text-muted-foreground">{employee.permanentAddress || "N/A"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employment Details */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          <CardTitle>Employment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium text-muted-foreground">Employee ID</div>
            <div className="text-sm">{employee.employeeId}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Department</div>
            <div className="text-sm">{employee.departmentRelation?.name || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Sub Department</div>
            <div className="text-sm">{employee.subDepartmentRelation?.name || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Designation</div>
            <div className="text-sm">{employee.designationRelation?.name || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Grade</div>
            <div className="text-sm">{employee.employeeGradeRelation?.grade || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Status</div>
            <div className="text-sm capitalize">{employee.employmentStatusRelation?.status || employee.status || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Joining Date</div>
            <div className="text-sm">{formatDate(employee.joiningDate)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Bank Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-2 gap-2">
            <div className="text-sm font-medium text-muted-foreground">Bank Name</div>
            <div className="text-sm">{employee.bankName || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Account Title</div>
            <div className="text-sm">{employee.accountTitle || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Account Number</div>
            <div className="text-sm font-family-mono">{employee.accountNumber || "N/A"}</div>
            
            <div className="text-sm font-medium text-muted-foreground">Salary</div>
            <div className="text-sm">PKR {employee.employeeSalary?.toLocaleString() || "N/A"}</div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
