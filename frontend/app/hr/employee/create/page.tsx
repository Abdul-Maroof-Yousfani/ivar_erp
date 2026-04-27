"use client";

import { useState, useEffect, startTransition, addTransitionType } from "react";
import { toast } from "sonner";
import { EmployeeForm } from "@/components/employee-form";
import type { Department, SubDepartment } from "@/lib/actions/department";
import type { EmployeeGrade } from "@/lib/actions/employee-grade";
import type { Designation } from "@/lib/actions/designation";
import type { MaritalStatus } from "@/lib/actions/marital-status";
import type { EmployeeStatus } from "@/lib/actions/employee-status";
import type { Location } from "@/lib/actions/location";
import type { State, City } from "@/lib/actions/city";
import type { Equipment } from "@/lib/actions/equipment";
import type { WorkingHoursPolicy } from "@/lib/actions/working-hours-policy";
import type { LeavesPolicy } from "@/lib/actions/leaves-policy";
import type { Qualification } from "@/lib/actions/qualification";
import type { Institute } from "@/lib/actions/institute";
import type { Allocation } from "@/lib/actions/allocation";
import type { Employee } from "@/lib/actions/employee";
import {
  searchEmployeeForRejoin,
  rejoinEmployee,
  getEmployeesForDropdown,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  UserPlus,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateEmployeePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "rejoin">("create");

  // Dropdown data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments] = useState<SubDepartment[]>([]);
  const [employeeGrades, setEmployeeGrades] = useState<EmployeeGrade[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>(
    []
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities] = useState<City[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [workingHoursPolicies, setWorkingHoursPolicies] = useState<
    WorkingHoursPolicy[]
  >([]);
  const [leavesPolicies, setLeavesPolicies] = useState<LeavesPolicy[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [socialSecurityInstitutions, setSocialSecurityInstitutions] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [, setEmployeeList] = useState<EmployeeDropdownOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Rejoin state
  const [rejoinCnic, setRejoinCnic] = useState("");
  const [searchingCnic, setSearchingCnic] = useState(false);
  const [foundEmployee, setFoundEmployee] = useState<Employee | null>(null);
  const [canRejoin, setCanRejoin] = useState(false);
  const [rejoinError, setRejoinError] = useState("");

  // Fetch dropdown data for both create and rejoin forms
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);
        const [formDataRes, employeesRes] = await Promise.all([
          fetch(`/internal-api/data/employee-create`, { cache: "no-store" }),
          getEmployeesForDropdown(),
        ]);
        const json = await formDataRes.json();
        if (json.status) {
          const d = json.data || {};
          setDepartments(d.departments || []);
          setEmployeeGrades(d.employeeGrades || []);
          setDesignations(d.designations || []);
          setMaritalStatuses(d.maritalStatuses || []);
          setEmployeeStatuses(d.employeeStatuses || []);
          setLocations(d.locations || []);
          setStates(d.states || []);
          setEquipments(d.equipments || []);
          setWorkingHoursPolicies(d.workingHoursPolicies || []);
          setLeavesPolicies(d.leavesPolicies || []);
          setQualifications(d.qualifications || []);
          setInstitutes(d.institutes || []);
          setSocialSecurityInstitutions(d.socialSecurityInstitutions || []);
          setAllocations(d.allocations || []);
          setBanks(d.banks || []);
        } else {
          toast.error(json.message || "Failed to load form data");
        }
        if (employeesRes.status && employeesRes.data) {
          setEmployeeList(employeesRes.data);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        // toast.error("Failed to load form data");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);

  const handleQualificationAdded = (qualification: {
    id: string;
    name: string;
  }) => {
    setQualifications((prev) => [
      ...prev,
      {
        ...qualification,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Qualification,
    ]);
  };

  const handleInstituteAdded = (institute: { id: string; name: string }) => {
    setInstitutes((prev) => [
      ...prev,
      {
        ...institute,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Institute,
    ]);
  };

  // Search for employee by CNIC
  const handleSearchCnic = async () => {
    if (!rejoinCnic.trim()) {
      toast.error("Please enter a CNIC number");
      return;
    }

    setSearchingCnic(true);
    setFoundEmployee(null);
    setCanRejoin(false);
    setRejoinError("");

    try {
      const result = await searchEmployeeForRejoin(rejoinCnic.trim());

      if (result.status && result.canRejoin && result.data) {
        setFoundEmployee(result.data);
        setCanRejoin(true);
        toast.success(result.message);
      } else {
        setRejoinError(
          result.message || "Employee not found or cannot be rejoined"
        );
        if (result.data) {
          setFoundEmployee(result.data as Employee);
        }
      }
    } catch (error) {
      console.error("Error searching CNIC:", error);
      setRejoinError("Failed to search for employee");
    } finally {
      setSearchingCnic(false);
    }
  };

  // Reset rejoin form
  const handleResetRejoin = () => {
    setRejoinCnic("");
    setFoundEmployee(null);
    setCanRejoin(false);
    setRejoinError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Add Employee</h2>
          <p className="text-muted-foreground">
            Create a new employee or rejoin an existing one
          </p>
        </div>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "create" | "rejoin")}
        className="w-full"
      >
        <div className="flex items-center justify-between">
          <Link href="/hr/employee/list" transitionTypes={["nav-back"]} >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              New Employee
            </TabsTrigger>
            <TabsTrigger value="rejoin" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Rejoin Employee
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="create" className="mt-6">
          <EmployeeForm
            mode="create"
            departments={departments}
            subDepartments={subDepartments}
            employeeGrades={employeeGrades}
            designations={designations}
            maritalStatuses={maritalStatuses}
            employeeStatuses={employeeStatuses}
            locations={locations}
            states={states}
            cities={cities}
            equipments={equipments}
            workingHoursPolicies={workingHoursPolicies}
            leavesPolicies={leavesPolicies}
            qualifications={qualifications}
            institutes={institutes}
            socialSecurityInstitutions={socialSecurityInstitutions}
            allocations={allocations}
            banks={banks}
            loadingData={loadingData}
            onQualificationAdded={handleQualificationAdded}
            onInstituteAdded={handleInstituteAdded}
          />
        </TabsContent>

        <TabsContent value="rejoin" className="mt-6 space-y-6">
          {/* CNIC Search Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search by CNIC
              </CardTitle>
              <CardDescription>
                Enter the CNIC of the employee who left and wants to rejoin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="cnic">
                    CNIC Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cnic"
                    placeholder="Enter CNIC (e.g., 12345-1234567-1)"
                    value={rejoinCnic}
                    onChange={(e) => setRejoinCnic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchCnic()}
                  />
                </div>
                <Button
                  onClick={handleSearchCnic}
                  disabled={searchingCnic || !rejoinCnic.trim()}
                >
                  {searchingCnic ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
                {foundEmployee && canRejoin && (
                  <Button variant="outline" onClick={handleResetRejoin}>
                    Reset
                  </Button>
                )}
              </div>

              {/* Error Message */}
              {rejoinError && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">
                      Cannot Rejoin
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rejoinError}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Found Employee Details - Use Full EmployeeForm for Rejoining */}
          {foundEmployee && canRejoin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Employee Found - Rejoining
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-800"
                  >
                    Rejoining
                  </Badge>
                </div>
                <CardDescription>
                  Review and update all employee details for rejoining. CNIC cannot be changed.
                  All other fields can be updated including name, contact information, address, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EmployeeForm
                  mode="rejoin"
                  initialData={foundEmployee}
                  departments={departments}
                  subDepartments={subDepartments}
                  employeeGrades={employeeGrades}
                  designations={designations}
                  maritalStatuses={maritalStatuses}
                  employeeStatuses={employeeStatuses}
                  locations={locations}
                  states={states}
                  cities={cities}
                  equipments={equipments}
                  workingHoursPolicies={workingHoursPolicies}
                  leavesPolicies={leavesPolicies}
                  qualifications={qualifications}
                  institutes={institutes}
                  socialSecurityInstitutions={socialSecurityInstitutions}
                  allocations={allocations}
                  banks={banks}
                  loadingData={loadingData}
                  onQualificationAdded={handleQualificationAdded}
                  onInstituteAdded={handleInstituteAdded}
                  cnic={foundEmployee.cnicNumber}
                  onRejoinSubmit={async (data) => {
                    try {
                      const result = await rejoinEmployee(data);
                      if (result.status) {
                        toast.success(result.message || "Employee rejoined successfully!");
                        startTransition(() => {
                          addTransitionType("nav-forward");
                          router.push("/hr/employee/list");
                        });
                      } else {
                        toast.error(result.message || "Failed to rejoin employee");
                      }

                    } catch (error) {
                      console.error("Error rejoining employee:", error);
                      toast.error("Failed to rejoin employee");
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!foundEmployee && !searchingCnic && !rejoinError && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <UserCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                  Search for Employee
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Enter the CNIC number of the employee who previously left and
                  wants to rejoin the organization. The system will find their
                  records and allow you to update their details for rejoining.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
