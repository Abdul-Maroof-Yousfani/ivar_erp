import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, User, Edit, Upload, ExternalLink, FileText, Calendar, LogIn, LogOut, Eye, History, MapPin } from "lucide-react";
import Link from "next/link";
import { getEmployeeById, getEmployees, getEmployeeRejoiningHistory } from "@/lib/actions/employee";
import { getTransferHistory } from "@/lib/actions/transfer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewEmployeePage({ params }: PageProps) {
  const { id: employeeId } = await params;

  // Fetch employee with all relations, employees list, and rejoining history
  const [employeeRes, employeesRes, historyRes, transferRes] = await Promise.all([
    getEmployeeById(employeeId),
    getEmployees(), // Only needed for reporting manager name lookup
    getEmployeeRejoiningHistory(employeeId),
    getTransferHistory(employeeId),
  ]);

  if (!employeeRes.status || !employeeRes.data) {
    notFound();
  }

  const employee = employeeRes.data as any;
  const employees = employeesRes.status ? employeesRes.data || [] : [];
  const rejoiningHistory = historyRes.status ? historyRes.data || [] : [];
  const transferHistory = transferRes.status ? transferRes.data || [] : [];


  // Helper functions to get names from relations
  // Backend returns relation objects under *Relation properties and also spreads them initially
  const getDepartmentName = () => {
    const dept = (employee as any).departmentRelation || (employee as any).department;
    return (dept && typeof dept === 'object' && dept.name) ? dept.name : "N/A";
  };

  const getSubDepartmentName = () => {
    const subDept = (employee as any).subDepartmentRelation || (employee as any).subDepartment;
    return (subDept && typeof subDept === 'object' && subDept.name) ? subDept.name : "N/A";
  };

  const getEmployeeGradeName = () => {
    const grade = (employee as any).employeeGradeRelation || (employee as any).employeeGrade;
    return (grade && typeof grade === 'object' && grade.grade) ? grade.grade : "N/A";
  };

  const getDesignationName = () => {
    const designation = (employee as any).designationRelation || (employee as any).designation;
    return (designation && typeof designation === 'object' && designation.name) ? designation.name : "N/A";
  };

  const getMaritalStatusName = () => {
    const maritalStatus = (employee as any).maritalStatusRelation || (employee as any).maritalStatus;
    return (maritalStatus && typeof maritalStatus === 'object' && maritalStatus.name) ? maritalStatus.name : "N/A";
  };

  const getEmploymentStatusName = () => {
    const employmentStatus = (employee as any).employmentStatusRelation || (employee as any).employmentStatus;
    return (employmentStatus && typeof employmentStatus === 'object' && employmentStatus.status) ? employmentStatus.status : "N/A";
  };

  const getLocationName = () => {
    const location = (employee as any).locationRelation || (employee as any).location;
    return (location && typeof location === 'object' && location.name) ? location.name : "N/A";
  };

  const getWorkingHoursPolicyName = () => {
    const policy = (employee as any).workingHoursPolicyRelation || (employee as any).workingHoursPolicy;
    return (policy && typeof policy === 'object' && policy.name) ? policy.name : "N/A";
  };

  const getLeavesPolicyName = () => {
    const policy = (employee as any).leavesPolicyRelation || (employee as any).leavesPolicy;
    return (policy && typeof policy === 'object' && policy.name) ? policy.name : "N/A";
  };

  const getAllocationName = () => {
    const allocation = (employee as any).allocationRelation || (employee as any).allocation;
    return (allocation && typeof allocation === 'object' && allocation.name) ? allocation.name : "N/A";
  };

  const getReportingManagerName = () => {
    if (!employee.reportingManager) return "N/A";
    const manager = employees.find(e => e.id === employee.reportingManager);
    return manager ? `${manager.employeeName} (${manager.employeeId})` : employee.reportingManager;
  };

  const getStateName = () => {
    const state = (employee as any).stateRelation || (employee as any).provinceRelation || (employee as any).state;
    return (state && typeof state === 'object' && state.name) ? state.name : "N/A";
  };

  const getCityName = () => {
    const city = (employee as any).cityRelation || (employee as any).city;
    return (city && typeof city === 'object' && city.name) ? city.name : "N/A";
  };

  const getCountryName = () => {
    const country = (employee as any).countryRelation || (employee as any).country;
    return (country && typeof country === 'object' && country.name) ? country.name : "N/A";
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Build timeline events
  // Add rejoining history events (sorted by date, oldest first)
  const sortedHistory = [...rejoiningHistory].sort((a, b) =>
    new Date(a.rejoiningDate).getTime() - new Date(b.rejoiningDate).getTime()
  );

  const timelineEvents: Array<{
    type: 'joined' | 'rejoined' | 'exited';
    date: string;
    title: string;
    description: string;
    iconType: 'joined' | 'rejoined' | 'exited';
    historyEvent?: any;
  }> = [];

  // Add original joining date
  if (employee.originalJoiningDate || employee.joiningDate) {
    const originalDate = employee.originalJoiningDate || employee.joiningDate;
    timelineEvents.push({
      type: 'joined',
      date: originalDate,
      title: 'Original Joining',
      description: `Employee joined with ID: ${employee.employeeId}`,
      iconType: 'joined',
    });
  }

  sortedHistory.forEach((event: any, index: number) => {
    // Add exit event before rejoining
    if (event.previousExitDate) {
      timelineEvents.push({
        type: 'exited',
        date: event.previousExitDate,
        title: `Exit #${index + 1}`,
        description: `Employee left with ID: ${event.previousEmployeeId}`,
        iconType: 'exited',
      });
    }

    // Add rejoining event
    timelineEvents.push({
      type: 'rejoined',
      date: event.rejoiningDate,
      title: `Rejoin #${index + 1}`,
      description: `Employee rejoined with new ID: ${event.newEmployeeId}${event.remarks ? ` - ${event.remarks}` : ''}`,
      iconType: 'rejoined',
      historyEvent: event,
    });
  });

  // Add current exit if employee is inactive/resigned/terminated
  if (employee.lastExitDate && (employee.status === 'inactive' || employee.status === 'resigned' || employee.status === 'terminated')) {
    timelineEvents.push({
      type: 'exited',
      date: employee.lastExitDate,
      title: 'Current Exit',
      description: `Employee status: ${employee.status}`,
      iconType: 'exited',
    });
  }

  // Sort all events by date
  timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const formatCNIC = (cnic: string) => {
    if (!cnic) return "N/A";
    const cleaned = cnic.replace(/-/g, "");
    if (cleaned.length === 13) {
      return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
    }
    return cnic;
  };

  // Component to display historical employee data
  const HistoricalEmployeeData = ({ data }: { data: any }) => {
    if (!data || typeof data !== 'object') {
      return <p className="text-muted-foreground">No historical data available</p>;
    }

    const historicalEmployee = data as any;

    // Helper functions for historical data (similar to main helpers)
    const getHistoricalDepartmentName = () => {
      const dept = historicalEmployee.departmentRelation || historicalEmployee.department;
      return (dept && typeof dept === 'object' && dept.name) ? dept.name : historicalEmployee.departmentId || "N/A";
    };

    const getHistoricalSubDepartmentName = () => {
      const subDept = historicalEmployee.subDepartmentRelation || historicalEmployee.subDepartment;
      return (subDept && typeof subDept === 'object' && subDept.name) ? subDept.name : historicalEmployee.subDepartmentId || "N/A";
    };

    const getHistoricalEmployeeGradeName = () => {
      const grade = historicalEmployee.employeeGradeRelation || historicalEmployee.employeeGrade;
      return (grade && typeof grade === 'object' && grade.grade) ? grade.grade : historicalEmployee.employeeGradeId || "N/A";
    };

    const getHistoricalDesignationName = () => {
      const designation = historicalEmployee.designationRelation || historicalEmployee.designation;
      return (designation && typeof designation === 'object' && designation.name) ? designation.name : historicalEmployee.designationId || "N/A";
    };

    const getHistoricalMaritalStatusName = () => {
      const maritalStatus = historicalEmployee.maritalStatusRelation || historicalEmployee.maritalStatus;
      return (maritalStatus && typeof maritalStatus === 'object' && maritalStatus.status) ? maritalStatus.status : historicalEmployee.maritalStatusId || "N/A";
    };

    const getHistoricalEmploymentStatusName = () => {
      const employmentStatus = historicalEmployee.employmentStatusRelation || historicalEmployee.employmentStatus;
      return (employmentStatus && typeof employmentStatus === 'object' && employmentStatus.status) ? employmentStatus.status : historicalEmployee.employmentStatusId || "N/A";
    };

    const getHistoricalLocationName = () => {
      const location = historicalEmployee.locationRelation || historicalEmployee.location;
      return (location && typeof location === 'object' && location.name) ? location.name : historicalEmployee.locationId || "N/A";
    };

    const getHistoricalWorkingHoursPolicyName = () => {
      const policy = historicalEmployee.workingHoursPolicyRelation || historicalEmployee.workingHoursPolicy;
      return (policy && typeof policy === 'object' && policy.name) ? policy.name : historicalEmployee.workingHoursPolicyId || "N/A";
    };

    const getHistoricalLeavesPolicyName = () => {
      const policy = historicalEmployee.leavesPolicyRelation || historicalEmployee.leavesPolicy;
      return (policy && typeof policy === 'object' && policy.name) ? policy.name : historicalEmployee.leavesPolicyId || "N/A";
    };

    const getHistoricalAllocationName = () => {
      const allocation = historicalEmployee.allocationRelation || historicalEmployee.allocation;
      return (allocation && typeof allocation === 'object' && allocation.name) ? allocation.name : historicalEmployee.allocationId || "N/A";
    };

    const getHistoricalStateName = () => {
      const state = historicalEmployee.stateRelation || historicalEmployee.provinceRelation || historicalEmployee.state;
      return (state && typeof state === 'object' && state.name) ? state.name : historicalEmployee.stateId || "N/A";
    };

    const getHistoricalCityName = () => {
      const city = historicalEmployee.cityRelation || historicalEmployee.city;
      return (city && typeof city === 'object' && city.name) ? city.name : historicalEmployee.cityId || "N/A";
    };

    const getHistoricalCountryName = () => {
      const country = historicalEmployee.countryRelation || historicalEmployee.country;
      return (country && typeof country === 'object' && country.name) ? country.name : historicalEmployee.countryId || "N/A";
    };

    // Helper component for email with tooltip
    const EmailField = ({ email, label }: { email: string | null | undefined; label: string }) => {
      const emailValue = email || "N/A";
      if (emailValue === "N/A") {
        return <p className="text-foreground font-semibold text-sm mt-1">{emailValue}</p>;
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-foreground font-semibold text-sm mt-1 line-clamp-1 cursor-help">
              {emailValue}
            </p>
          </TooltipTrigger>
          <TooltipContent>
            <p>{emailValue}</p>
          </TooltipContent>
        </Tooltip>
      );
    };

    return (
      <div className="h-[70vh] pr-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Employee ID", value: historicalEmployee.employeeId || "N/A" },
                  { label: "Employee Name", value: historicalEmployee.employeeName || "N/A" },
                  { label: "Father / Husband Name", value: historicalEmployee.fatherHusbandName || "N/A" },
                  { label: "Allocation", value: getHistoricalAllocationName() },
                  { label: "Department", value: getHistoricalDepartmentName() },
                  { label: "Sub Department", value: getHistoricalSubDepartmentName() },
                  { label: "Employee Grade", value: getHistoricalEmployeeGradeName() },
                  { label: "Attendance ID", value: historicalEmployee.attendanceId || "N/A" },
                  { label: "Designation", value: getHistoricalDesignationName() },
                  { label: "Marital Status", value: getHistoricalMaritalStatusName() },
                  { label: "Employment Status", value: getHistoricalEmploymentStatusName() },
                  { label: "CNIC Number", value: formatCNIC(historicalEmployee.cnicNumber) },
                  { label: "Joining Date", value: formatDate(historicalEmployee.joiningDate) },
                  { label: "Date of Birth", value: formatDate(historicalEmployee.dateOfBirth) },
                  { label: "Nationality", value: historicalEmployee.nationality || "N/A" },
                  { label: "Gender", value: historicalEmployee.gender || "N/A" },
                  { label: "Contact Number", value: historicalEmployee.contactNumber || "N/A" },
                  { label: "Personal Email", value: historicalEmployee.personalEmail, isEmail: true },
                  { label: "Official Email", value: historicalEmployee.officialEmail, isEmail: true },
                  { label: "Country", value: getHistoricalCountryName() },
                  { label: "State / Province", value: getHistoricalStateName() },
                  { label: "City", value: getHistoricalCityName() },
                  { label: "Employee Salary", value: historicalEmployee.employeeSalary ? `PKR ${Number(historicalEmployee.employeeSalary).toLocaleString()}` : "N/A" },
                  { label: "Working Hours Policy", value: getHistoricalWorkingHoursPolicyName() },
                  { label: "Location", value: getHistoricalLocationName() },
                  { label: "Leaves Policy", value: getHistoricalLeavesPolicyName() },
                  { label: "Status", value: historicalEmployee.status || "N/A" },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-muted/10">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    {item.isEmail ? (
                      <EmailField email={item.value} label={item.label} />
                    ) : (
                      <p className="text-foreground font-semibold text-sm mt-1">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Helper function to get qualification name from relation object
  const getQualificationName = (qual: any) => {
    const qualification = qual?.qualification;
    return (qualification && typeof qualification === 'object' && qualification.name)
      ? qualification.name
      : "N/A";
  };

  return (
    <div className="max-w-[90%] mx-auto pb-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/hr/employee/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
        <Link href={`/hr/employee/edit/${employeeId}`} className="absolute left-1/2 -translate-x-1/2" transitionTypes={["nav-forward"]}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Employee
          </Button>
        </Link>
        <Link href={`/hr/employee/transfer?employeeId=${employeeId}`} transitionTypes={["nav-forward"]}>
          <Button variant="outline" className="ml-2">
            <MapPin className="h-4 w-4 mr-2" />
            Transfer Employee
          </Button>
        </Link>
      </div>

      <div className="border rounded-xl p-4 space-y-6">
        {/* Profile Header */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center border-2 border-border overflow-hidden">
                {employee.avatarUrl ? (
                  <img
                    src={employee.avatarUrl}
                    alt={employee.employeeName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-2xl">{employee.employeeName}</CardTitle>
                <CardDescription className="text-base mt-1">
                  {employee.employeeId}
                </CardDescription>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Badge variant={employee.status === "active" ? "default" : "secondary"}>
                    {employee.status}
                  </Badge>
                  {employee.isRejoined && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Rejoined ({employee.rejoinCount || 0}x)
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Transfer History */}
        {transferHistory && transferHistory.length > 0 && (
          <Card className="border-none shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Transfer History
              </CardTitle>
              <CardDescription>History of location transfers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-border ml-3 pl-6 space-y-6">
                {transferHistory.map((transfer: any) => (
                  <div key={transfer.id} className="relative">
                    <div className="absolute -left-[31px] bg-background border rounded-full p-1">
                      <MapPin className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Transferred to {transfer.newLocation?.name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(transfer.transferDate)}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-xs text-foreground/70">From: </span>
                        {transfer.previousLocation?.name || "N/A"}, {transfer.previousCity?.name || "N/A"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-xs text-foreground/70">To: </span>
                        {transfer.newLocation?.name}, {transfer.newCity?.name || "N/A"}
                      </div>
                      {transfer.reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{transfer.reason}"</p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Processed by: {transfer.createdBy?.firstName} {transfer.createdBy?.lastName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employment Timeline */}
        {timelineEvents.length > 0 && (
          <Card className="border-none shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Employment Timeline
              </CardTitle>
              <CardDescription>Complete history of join and exit events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>

                {/* Timeline events */}
                <div className="space-y-6">
                  {timelineEvents.map((event, index) => (
                    <div key={index} className="relative flex items-start gap-4">
                      {/* Icon */}
                      <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 bg-background ${event.iconType === 'joined' ? 'border-green-500' :
                        event.iconType === 'rejoined' ? 'border-blue-500' :
                          'border-red-500'
                        }`}>
                        {event.iconType === 'joined' ? (
                          <LogIn className="h-5 w-5 text-green-600" />
                        ) : event.iconType === 'rejoined' ? (
                          <LogIn className="h-5 w-5 text-blue-600" />
                        ) : (
                          <LogOut className="h-5 w-5 text-red-600" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <h4 className="font-semibold text-base">{event.title}</h4>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateTime(event.date)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>

                        {/* Show changed fields and view old data button for rejoining events */}
                        {event.type === 'rejoined' && event.historyEvent && (() => {
                          const historyEvent = event.historyEvent;
                          const hasPreviousState = historyEvent?.previousState && typeof historyEvent.previousState === 'object';

                          return (
                            <div className="mt-3 space-y-2 flex items-start justify-between">
                              {historyEvent?.keyChanges && Array.isArray(historyEvent.keyChanges) && historyEvent.keyChanges.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {historyEvent.keyChanges.slice(0, 5).map((field: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {field}
                                    </Badge>
                                  ))}
                                  {historyEvent.keyChanges.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{historyEvent.keyChanges.length - 5} more
                                    </Badge>
                                  )}
                                </div>
                              )}

                              {hasPreviousState && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" >
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Old Data
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <History className="h-5 w-5" />
                                        Employee Data Before Rejoin
                                      </DialogTitle>
                                      <DialogDescription>
                                        Historical employee data snapshot before rejoining on {formatDateTime(event.date)}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="flex-1 min-h-0 px-6 py-4" showShadows={true} shadowSize="md">
                                      <div className="space-y-4">
                                        <HistoricalEmployeeData data={historyEvent.previousState} />
                                      </div>
                                    </ScrollArea>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Basic Information */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Basic Information</CardTitle>
            <CardDescription>Employee personal & job-related details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: "Employee ID", value: employee.employeeId },
                { label: "Employee Name", value: employee.employeeName },
                { label: "Father / Husband Name", value: employee.fatherHusbandName || "N/A" },
                { label: "Allocation", value: getAllocationName() },
                { label: "Department", value: getDepartmentName() },
                { label: "Sub Department", value: getSubDepartmentName() },
                { label: "Employee Grade", value: getEmployeeGradeName() },
                { label: "Attendance ID", value: employee.attendanceId || "N/A" },
                { label: "Designation", value: getDesignationName() },
                { label: "Marital Status", value: getMaritalStatusName() },
                { label: "Employment Status", value: getEmploymentStatusName() },
                { label: "Probation Expiry Date", value: formatDate(employee.probationExpiryDate) },
                { label: "CNIC Number", value: formatCNIC(employee.cnicNumber) },
                { label: "CNIC Expiry Date", value: employee.lifetimeCnic ? "Lifetime" : formatDate(employee.cnicExpiryDate) },
                { label: "Joining Date", value: formatDate(employee.joiningDate) },
                { label: "Date of Birth", value: formatDate(employee.dateOfBirth) },
                { label: "Nationality", value: employee.nationality || "N/A" },
                { label: "Gender", value: employee.gender || "N/A" },
                { label: "Contact Number", value: employee.contactNumber || "N/A" },
                { label: "Emergency Contact Number", value: employee.emergencyContactNumber || "N/A" },
                { label: "Emergency Contact Person", value: employee.emergencyContactPerson || "N/A" },
                { label: "Personal Email", value: employee.personalEmail || "N/A" },
                { label: "Official Email", value: employee.officialEmail || "N/A" },
                { label: "Country", value: getCountryName() },
                { label: "State / Province", value: getStateName() },
                { label: "City", value: getCityName() },
                { label: "Employee Salary", value: `PKR ${Number(employee.employeeSalary).toLocaleString()}` },
                { label: "EOBI", value: employee.eobi ? "Yes" : "No" },
                ...(employee.eobi ? [
                  { label: "EOBI ID", value: employee.eobiId || "N/A" },
                  { label: "EOBI Code", value: employee.eobiCode || "N/A" },
                  { label: "EOBI Number", value: employee.eobiNumber || "N/A" }
                ] : []),
                ...(employee.eobi && employee.eobiDocumentUrl ? [{
                  label: "EOBI Document",
                  value: (
                    <a
                      href={employee.eobiDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <Upload className="h-4 w-4" />
                      View Document
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )
                }] : []),
                { label: "Provident Fund", value: employee.providentFund ? "Yes" : "No" },
                { label: "Overtime Applicable", value: employee.overtimeApplicable ? "Yes" : "No" },
                { label: "Days Off", value: employee.daysOff || "N/A" },
                { label: "Reporting Manager", value: getReportingManagerName() },
                { label: "Working Hours Policy", value: getWorkingHoursPolicyName() },
                { label: "Location", value: getLocationName() },
                { label: "Leaves Policy", value: getLeavesPolicyName() },
                { label: "Allow Remote Attendance", value: employee.allowRemoteAttendance ? "Yes" : "No" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
                >
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-foreground font-semibold text-1xl mt-1">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Qualification Section */}
        {employee.qualifications && Array.isArray(employee.qualifications) && employee.qualifications.length > 0 && (
          <Card className="border-none shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Qualifications</CardTitle>
              <CardDescription>Employee educational qualifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employee.qualifications.map((qual: any, index: number) => (
                  <div key={qual.id || index} className="p-4 border rounded-lg bg-muted/30">
                    {employee.qualifications.length > 1 && (
                      <div className="text-sm font-medium text-muted-foreground mb-3">
                        Qualification {index + 1}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { label: "Qualification", value: getQualificationName(qual) },
                        { label: "Institute", value: (qual.institute as any)?.name || "N/A" },
                        { label: "Year", value: qual.year || "N/A" },
                        { label: "Grade", value: qual.grade || "N/A" },
                        { label: "State", value: (qual.state as any)?.name || "N/A" },
                        { label: "City", value: (qual.city as any)?.name || "N/A" },
                      ].map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
                        >
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-foreground font-semibold text-1xl mt-1">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    {/* Qualification Document */}
                    {(() => {
                      // Check documentUrl from qualification object first, then from documentUrls
                      const docUrl = qual.documentUrl ||
                        (employee.documentUrls && typeof employee.documentUrls === 'object'
                          ? (employee.documentUrls as Record<string, string>)[`qualification_${index}`]
                          : null);

                      return docUrl ? (
                        <div className="mt-4 p-4 border rounded-lg bg-muted/10">
                          <p className="text-xs text-muted-foreground mb-2">Degree Document</p>
                          <a
                            href={docUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            <span>View Document</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Address Information */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: "Current Address", value: employee.currentAddress },
              { label: "Permanent Address", value: employee.permanentAddress },
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
              >
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-foreground font-semibold text-1xl mt-1">
                  {item.value || "N/A"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Bank Account Details */}
        <Card className="border-none shadow-none">
          <CardHeader>
            <CardTitle>Bank Account Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Bank Name", value: employee.bankName },
              { label: "Account Number", value: employee.accountNumber },
              { label: "Account Title", value: employee.accountTitle },
            ].map((item, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
              >
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-foreground font-semibold text-1xl mt-1">
                  {item.value || "N/A"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Equipment Issued */}
        {employee.equipmentAssignments && employee.equipmentAssignments.length > 0 && (
          <Card className="border-none shadow-none">
            <CardHeader>
              <CardTitle>Equipment Issued</CardTitle>
              <CardDescription>Equipment assigned to this employee</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {employee.equipmentAssignments.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
                  >
                    <p className="text-xs text-muted-foreground">Equipment</p>
                    <p className="text-foreground font-semibold text-1xl mt-1">
                      {assignment.equipment?.name || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigned: {new Date(assignment.assignedDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Employee Document Uploads */}
        {employee.documentUrls && typeof employee.documentUrls === 'object' && Object.keys(employee.documentUrls).length > 0 && (() => {
          // Filter out qualification documents (they're shown in Qualification section)
          const filteredDocs = Object.entries(employee.documentUrls as Record<string, string>)
            .filter(([key]) => !key.startsWith('qualification_'));

          if (filteredDocs.length === 0) return null;

          return (
            <Card className="border-none shadow-none">
              <CardHeader>
                <CardTitle>Employee Document Uploads</CardTitle>
                <CardDescription>Documents uploaded for this employee</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDocs.map(([key, url]) => {
                    const documentLabels: Record<string, string> = {
                      cv: "CV",
                      educationDegrees: "Education Degrees",
                      passportPhotos: "Passport Size Photos",
                      cnic: "CNIC",
                      clearanceLetter: "Clearance Letter",
                      fitProperCriteria: "Fit & Proper Criteria Form",
                      serviceRulesAffirmation: "Company Service Rules Affirmation",
                      codeOfConduct: "VIS Code of Conduct 2019",
                      nda: "Non-Disclosure Agreement (NDA)",
                      secrecyForm: "Information Secrecy / Confidentiality Form",
                      investmentDisclosure: "Investment Disclosure Form",
                    };

                    const label = documentLabels[key] || key;
                    const fileName = url.split('/').pop() || 'Document';

                    return (
                      <div
                        key={key}
                        className="p-4 border rounded-lg bg-muted/10 hover:bg-muted/20 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-foreground font-semibold text-sm mt-1 truncate">
                              {fileName}
                            </p>
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            <FileText className="h-4 w-4" />
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div >
  );
}
