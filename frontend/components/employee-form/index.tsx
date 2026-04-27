"use client";

import { useState, useTransition, useEffect, useMemo, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Upload, Key } from "lucide-react";
import Link from "next/link";
import { FileUpload } from "@/components/ui/file-upload";
import { Autocomplete } from "@/components/ui/autocomplete";
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
import { createEmployee, updateEmployee, getEmployees, type Employee } from "@/lib/actions/employee";
import { BasicInfoSection } from "@/app/hr/employee/create/components/basic-info-section";
import { QualificationSection } from "@/app/hr/employee/create/components/qualification-section";
import { SocialSecuritySection } from "@/app/hr/employee/create/components/social-security-section";
import { EquipmentSection } from "@/app/hr/employee/create/components/equipment-section";
import { uploadFile } from "@/lib/upload";
import { DateSection } from "@/app/hr/employee/create/components/date-section";
import { getCountries } from "@/lib/actions/city";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// CNIC validation regex
const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;
const validateCNIC = (value: string) => {
  return cnicRegex.test(value);
};

// CNIC formatting function - converts raw digits to formatted CNIC
const formatCNICValue = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 5) {
    return digits;
  } else if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  } else {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  }
};

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Account number validation regex
const accountNumberRegex = /^\d{7,26}$/;

// Zod Validation Schema
const employeeFormSchema = z.object({
  // Basic Information
  employeeId: z
    .string()
    .min(1, "Employee ID is required")
    .min(5, "Employee ID must be at least 5 characters")
    .max(20, "Employee ID must not exceed 20 characters"),

  employeeName: z
    .string()
    .min(1, "Employee Name is required")
    .min(3, "Employee Name must be at least 3 characters")
    .max(100, "Employee Name must not exceed 100 characters"),

  fatherHusbandName: z
    .string()
    .min(1, "Father/Husband Name is required")
    .min(3, "Father/Husband Name must be at least 3 characters")
    .max(100, "Father/Husband Name must not exceed 100 characters"),

  department: z
    .string()
    .min(1, "Department is required"),

  subDepartment: z
    .string()
    .optional(),

  employeeGrade: z
    .string()
    .min(1, "Employee Grade is required"),

  attendanceId: z
    .string()
    .min(1, "Attendance ID is required")
    .min(3, "Attendance ID must be at least 3 characters")
    .max(20, "Attendance ID must not exceed 20 characters"),

  designation: z
    .string()
    .min(1, "Designation is required"),

  maritalStatus: z
    .string()
    .optional()
    .or(z.literal("")),

  employmentStatus: z
    .string()
    .optional()
    .or(z.literal("")),

  probationExpiryDate: z
    .string()
    .optional(),

  cnicNumber: z
    .string()
    .min(1, "CNIC Number is required")
    .refine(
      (value) => validateCNIC(value),
      "CNIC must be in format: 00000-0000000-0"
    ),

  cnicExpiryDate: z
    .string()
    .optional(),

  lifetimeCnic: z
    .boolean()
    .default(false),

  joiningDate: z
    .string()
    .optional()
    .refine(
      (date) => {
        if (!date) return true;
        const selectedDate = new Date(date);
        return selectedDate <= new Date();
      },
      "Joining Date cannot be in the future"
    ),

  dateOfBirth: z
    .string()
    .optional()
    .refine(
      (date) => {
        if (!date) return true;
        const dob = new Date(date);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        return age >= 18;
      },
      "Employee must be at least 18 years old"
    ),

  nationality: z
    .string()
    .min(1, "Nationality is required"),

  gender: z
    .string()
    .min(1, "Gender is required"),

  contactNumber: z
    .string()
    .min(1, "Contact Number is required")
    .refine(
      (value) => /^03\d{2}-\d{7}$|^\+92\d{10}$/.test(value.replace(/\s/g, "")),
      "Contact Number must be in format: 03XX-XXXXXXX"
    ),

  emergencyContactNumber: z
    .string()
    .optional()
  ,

  emergencyContactPersonName: z
    .string()
    .optional(),

  personalEmail: z
    .string()
    .optional()
    .refine(
      (value) => !value || emailRegex.test(value),
      "Personal Email must be a valid email address"
    ),

  officialEmail: z
    .string()
    .optional()
    .refine(
      (val) => !val || emailRegex.test(val),
      "Official Email must be a valid email address"
    ),

  country: z
    .string()
    .min(1, "Country is required"),

  state: z
    .string()
    .min(1, "State is required"),

  city: z
    .string()
    .min(1, "City is required"),

  employeeSalary: z
    .string()
    .min(1, "Employee Salary is required")
    .refine(
      (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num > 0;
      },
      "Employee Salary must be a positive number"
    ),

  // Benefits
  eobi: z
    .boolean()
    .default(false),

  eobiId: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.trim() === "" || value.trim().length > 0,
      "EOBI ID is required if provided"
    ),
  eobiCode: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.trim() === "" || value.trim().length > 0,
      "EOBI Code is required if provided"
    ),
  eobiNumber: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.trim() === "" || /^\d{7,10}$/.test(value.trim()),
      "EOBI Number must be 7-10 digits"
    ),

  providentFund: z
    .boolean()
    .default(false),

  overtimeApplicable: z
    .boolean()
    .default(false),

  daysOff: z
    .string()
    .optional(),

  reportingManager: z
    .string()
    .optional(),

  workingHoursPolicy: z
    .string()
    .min(1, "Working Hours Policy is required"),

  location: z
    .string()
    .optional(),

  leavesPolicy: z
    .string()
    .min(1, "Leaves Policy is required"),

  allocation: z
    .string()
    .min(1, "Allocation is required"),
  socialSecurityInstitutionId: z.string().optional(),

  allowRemoteAttendance: z
    .boolean()
    .default(false),

  // Address Information
  currentAddress: z
    .string()
    .optional(),

  permanentAddress: z
    .string()
    .optional(),

  bankName: z
    .string()
    .optional(),

  accountNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || accountNumberRegex.test(val),
      "Account Number must be between 7-26 digits"
    ),

  accountTitle: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.length >= 3,
      "Account Title must be at least 3 characters"
    )
    .refine(
      (val) => !val || val.length <= 100,
      "Account Title must not exceed 100 characters"
    ),

  avatarUrl: z.string().optional(),
  eobiDocumentUrl: z.string().optional(),

  // Social Security (SESSI/PESSE/IESSI)
  socialSecurityRegistrations: z
    .array(
      z.object({
        institutionId: z.string().min(1, "Institution is required"),
        registrationNumber: z.string().optional(),
        cardNumber: z.string().optional(),
        registrationDate: z.string().optional(),
        baseSalary: z.union([z.string(), z.number()]).optional(),
        monthlyContribution: z.union([z.string(), z.number()]).optional(),
        status: z.string().optional(),
      })
    )
    .default([])
    .optional(),

  // Equipment
  equipmentAssignments: z
    .array(
      z.object({
        equipmentId: z.string().min(1, "Item type is required"),
        productId: z.string().optional(),
        assignedDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .default([]),

  // Qualifications
  qualifications: z
    .array(
      z.object({
        qualification: z.string().optional(),
        instituteId: z.string().optional(),
        stateId: z.string().optional(),
        cityId: z.string().optional(),
        year: z.union([z.string(), z.number()]).optional(),
        grade: z.string().optional(),
        documentUrl: z.string().optional(),
      })
    )
    .default([])
    .optional(),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

interface EmployeeFormProps {
  mode: "create" | "edit" | "rejoin";
  initialData?: Employee;
  departments: Department[];
  subDepartments: SubDepartment[];
  employeeGrades: EmployeeGrade[];
  designations: Designation[];
  maritalStatuses: MaritalStatus[];
  employeeStatuses: EmployeeStatus[];
  locations: Location[];
  states: State[];
  cities: City[];
  equipments: Equipment[];
  workingHoursPolicies: WorkingHoursPolicy[];
  leavesPolicies: LeavesPolicy[];
  allocations: Allocation[];
  qualifications?: Qualification[];
  institutes?: Institute[];
  socialSecurityInstitutions?: any[];
  banks?: any[];
  loadingData: boolean;
  onQualificationAdded?: (qualification: { id: string; name: string }) => void;
  onInstituteAdded?: (institute: { id: string; name: string }) => void;
  // For rejoin mode
  cnic?: string;
  onRejoinSubmit?: (data: any) => Promise<void>;
}

export function EmployeeForm({
  mode,
  initialData,
  departments,
  subDepartments: initialSubDepartments,
  employeeGrades,
  designations,
  maritalStatuses,
  employeeStatuses,
  locations,
  states,
  cities: initialCities,
  equipments,
  workingHoursPolicies,
  leavesPolicies,
  allocations,
  qualifications = [],
  institutes = [],
  socialSecurityInstitutions = [],
  banks = [],
  loadingData,
  onQualificationAdded,
  onInstituteAdded,
  cnic,
  onRejoinSubmit,
}: EmployeeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // React Hook Form with Zod validation
  const form = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: initialData ? {
      employeeId: initialData.employeeId || "",
      employeeName: initialData.employeeName || "",
      fatherHusbandName: initialData.fatherHusbandName || "",
      department: (initialData as any).departmentId || (typeof initialData.department === 'string' ? initialData.department : (initialData.department as any)?.id) || "",
      subDepartment: (initialData as any).subDepartmentId || (typeof initialData.subDepartment === 'string' ? initialData.subDepartment : (initialData.subDepartment as any)?.id) || "",
      employeeGrade: (initialData as any).employeeGradeId || (typeof initialData.employeeGrade === 'string' ? initialData.employeeGrade : (initialData.employeeGrade as any)?.id) || "",
      attendanceId: initialData.attendanceId || "",
      designation: (initialData as any).designationId || (typeof initialData.designation === 'string' ? initialData.designation : (initialData.designation as any)?.id) || "",
      maritalStatus: (initialData as any).maritalStatusId || (typeof initialData.maritalStatus === 'string' ? initialData.maritalStatus : (initialData.maritalStatus as any)?.id) || "",
      employmentStatus: (initialData as any).employmentStatusId || (typeof initialData.employmentStatus === 'string' ? initialData.employmentStatus : (initialData.employmentStatus as any)?.id) || "",
      probationExpiryDate: initialData.probationExpiryDate || "",
      cnicNumber: formatCNICValue(initialData.cnicNumber || ""),
      cnicExpiryDate: initialData.cnicExpiryDate || "",
      lifetimeCnic: initialData.lifetimeCnic || false,
      joiningDate: initialData.joiningDate || "",
      dateOfBirth: initialData.dateOfBirth || "",
      nationality: initialData.nationality || "Pakistani",
      gender: initialData.gender || "",
      contactNumber: initialData.contactNumber || "",
      emergencyContactNumber: initialData.emergencyContactNumber || "",
      emergencyContactPersonName: (initialData as any).emergencyContactPersonName || initialData.emergencyContactPerson || "",
      personalEmail: initialData.personalEmail || "",
      officialEmail: initialData.officialEmail || "",
      country: (initialData as any).countryId || (typeof initialData.country === 'string' ? initialData.country : (initialData.country as any)?.id) || "Pakistan",
      state: (initialData as any).stateId || (typeof (initialData as any).province === 'string' ? (initialData as any).province : (initialData as any).province?.id) || (typeof (initialData as any).state === 'string' ? (initialData as any).state : (initialData as any).state?.id) || "",
      city: (initialData as any).cityId || (typeof initialData.city === 'string' ? initialData.city : (initialData.city as any)?.id) || "",
      employeeSalary: initialData.employeeSalary?.toString() || "",
      eobi: initialData.eobi || false,
      eobiId: (initialData as any).eobiId || "",
      eobiCode: (initialData as any).eobiCode || "",
      eobiNumber: initialData.eobiNumber || "",
      providentFund: initialData.providentFund || false,
      overtimeApplicable: initialData.overtimeApplicable || false,
      daysOff: initialData.daysOff || "",
      reportingManager: initialData.reportingManager || "",
      workingHoursPolicy: (initialData as any).workingHoursPolicyId || (typeof initialData.workingHoursPolicy === 'string' ? initialData.workingHoursPolicy : (initialData.workingHoursPolicy as any)?.id) || "",
      location: (initialData as any).locationId || (typeof (initialData as any).location === 'string' ? (initialData as any).location : (initialData as any).location?.id) || (initialData as any).branchId || (typeof (initialData as any).branch === 'string' ? (initialData as any).branch : (initialData as any).branch?.id) || "",
      leavesPolicy: (initialData as any).leavesPolicyId || (typeof initialData.leavesPolicy === 'string' ? initialData.leavesPolicy : (initialData.leavesPolicy as any)?.id) || "",
      allocation: (initialData as any).allocationId || (typeof (initialData as any).allocation === 'string' ? (initialData as any).allocation : (initialData as any).allocation?.id) || (initialData as any).allocationId || "",
      socialSecurityInstitutionId: (initialData as any).socialSecurityInstitutionId || "",
      allowRemoteAttendance: initialData.allowRemoteAttendance || false,
      currentAddress: initialData.currentAddress ?? "",
      permanentAddress: initialData.permanentAddress ?? "",
      bankName: initialData.bankName || "",
      accountNumber: initialData.accountNumber || "",
      accountTitle: initialData.accountTitle || "",
      equipmentAssignments: (initialData as any).equipmentAssignments
        ? (initialData as any).equipmentAssignments.map((ea: any) => ({
          equipmentId: ea.equipment?.id || ea.equipmentId || "",
          productId: ea.productId || "",
          assignedDate: ea.assignedDate ? new Date(ea.assignedDate).toISOString() : new Date().toISOString(),
          notes: ea.notes || "",
        }))
        : [],
      avatarUrl: (initialData as any).avatarUrl || "",
      eobiDocumentUrl: (initialData as any).eobiDocumentUrl || "",
      qualifications: (initialData as any).qualifications && Array.isArray((initialData as any).qualifications) && (initialData as any).qualifications.length > 0
        ? (initialData as any).qualifications.map((q: any) => ({
          qualification: q.qualificationId || q.qualification || "",
          instituteId: q.instituteId || "",
          stateId: q.stateId || "",
          cityId: q.cityId || "",
          year: q.year?.toString() || "",
          grade: q.grade || "",
          documentUrl: q.documentUrl || "",
        }))
        : [{
          qualification: "",
          instituteId: "",
          stateId: "",
          cityId: "",
          year: "",
          grade: "",
          documentUrl: "",
        }],
      socialSecurityRegistrations: (initialData as any).socialSecurityRegistrations && Array.isArray((initialData as any).socialSecurityRegistrations)
        ? (initialData as any).socialSecurityRegistrations.map((reg: any) => ({
          institutionId: reg.institutionId || "",
          registrationNumber: reg.registrationNumber || "",
          cardNumber: reg.cardNumber || "",
          registrationDate: reg.registrationDate ? new Date(reg.registrationDate).toISOString().split('T')[0] : "",
          baseSalary: reg.baseSalary?.toString() || "",
          monthlyContribution: reg.monthlyContribution?.toString() || "",
          status: reg.status || "active",
        }))
        : [],
    } : {
      employeeId: "",
      employeeName: "",
      fatherHusbandName: "",
      department: "",
      subDepartment: "",
      employeeGrade: "",
      attendanceId: "",
      designation: "",
      maritalStatus: "",
      employmentStatus: "",
      probationExpiryDate: "",
      cnicNumber: "",
      cnicExpiryDate: "",
      lifetimeCnic: false,
      joiningDate: "",
      dateOfBirth: "",
      nationality: "Pakistani",
      gender: "",
      contactNumber: "",
      emergencyContactNumber: "",
      emergencyContactPersonName: "",
      personalEmail: "",
      officialEmail: "",
      country: "Pakistan",
      state: "",
      city: "",
      employeeSalary: "",
      eobi: false,
      eobiId: "",
      eobiCode: "",
      eobiNumber: "",
      providentFund: false,
      overtimeApplicable: false,
      daysOff: "",
      reportingManager: "",
      workingHoursPolicy: "",
      location: "",
      leavesPolicy: "",
      allocation: "",
      socialSecurityInstitutionId: "",
      allowRemoteAttendance: false,
      currentAddress: "",
      permanentAddress: "",
      bankName: "",
      accountNumber: "",
      accountTitle: "",
      equipmentAssignments: [],
      avatarUrl: "",
      eobiDocumentUrl: "",
      qualifications: [{
        qualification: "",
        instituteId: "",
        stateId: "",
        cityId: "",
        year: "",
        grade: "",
        documentUrl: "",
      }],
      socialSecurityRegistrations: [],
    },
    mode: "onChange",
    reValidateMode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = form;

  // Watch form values
  const department = watch("department");
  const state = watch("state");
  const avatarUrl = watch("avatarUrl");

  // Local state for dynamic dropdowns
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>(initialSubDepartments);
  const [cities, setCities] = useState<City[]>(initialCities);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; employeeName: string; employeeId: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Fetch employees for reporting manager dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const result = await getEmployees();
        if (result.status && result.data) {
          setEmployees(result.data.map(emp => ({
            id: emp.id,
            employeeName: emp.employeeName,
            employeeId: emp.employeeId
          })));
        }
      } catch (error) {
        // Error fetching employees
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  // Static options
  const nationalities = [
    "Pakistani",
    "American",
    "British",
    "Canadian",
    "Other",
  ];
  const genders = ["Male", "Female", "Other"];


  const defaultBanks = [
    "HBL",
    "UBL",
    "MCB",
    "Allied Bank",
    "Bank Alfalah",
    "Meezan Bank",
    "Standard Chartered",
  ];

  const bankList = useMemo(() => {
    // Use passed banks data if available, otherwise use defaults
    let list = banks && banks.length > 0 
      ? banks.map((b: any) => typeof b === 'string' ? b : b.name || b.bankName)
      : defaultBanks;
    
    // Add existing bank from initialData if not already in list
    if (initialData?.bankName && !list.includes(initialData.bankName)) {
      list = [...list, initialData.bankName];
    }
    return list;
  }, [banks, initialData?.bankName]);
  const daysOff = ["Sunday", "Saturday-Sunday", "Friday", "Friday-Saturday"];

  // Profile pic and documents state
  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(
    (initialData as any)?.avatarUrl || null
  );

  // Sync profilePicPreview with avatarUrl form value
  useEffect(() => {
    if (avatarUrl && avatarUrl.trim() !== '') {
      setProfilePicPreview(avatarUrl);
    }
  }, [avatarUrl]);

  // Initialize preview from initialData when component mounts
  useEffect(() => {
    if ((initialData as any)?.avatarUrl && !profilePicPreview) {
      setProfilePicPreview((initialData as any).avatarUrl);
    }
  }, []);

  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [documents, setDocuments] = useState<{ [key: string]: File | null }>({
    cv: null,
    passportPhotos: null,
    cnic: null,
    clearanceLetter: null,
    fitProperCriteria: null,
    serviceRulesAffirmation: null,
    codeOfConduct: null,
    nda: null,
    secrecyForm: null,
    investmentDisclosure: null,
    eobi: null,
  });
  // Initialize documentUrls with existing documents when editing
  // Same pattern as Equipments & Documents section
  const initialDocumentUrls: { [key: string]: string } = {};
  if (mode === "edit") {
    // Add EOBI document URL
    if ((initialData as any)?.eobiDocumentUrl) {
      initialDocumentUrls.eobi = (initialData as any).eobiDocumentUrl;
    }
    // Add all other document URLs from documentUrls JSON field
    if ((initialData as any)?.documentUrls && typeof (initialData as any).documentUrls === 'object') {
      const existingDocs = (initialData as any).documentUrls;
      Object.keys(existingDocs).forEach((key) => {
        if (existingDocs[key] && typeof existingDocs[key] === 'string') {
          initialDocumentUrls[key] = existingDocs[key];
        }
      });
    }
    // Add qualification documents to documentUrls object (same pattern)
    if ((initialData as any)?.qualifications && Array.isArray((initialData as any).qualifications)) {
      (initialData as any).qualifications.forEach((q: any, index: number) => {
        if (q.documentUrl) {
          const qualKey = `qualification_${index}`;
          initialDocumentUrls[qualKey] = q.documentUrl;
        }
      });
    }
  }
  const [documentUrls, setDocumentUrls] = useState<{ [key: string]: string }>(initialDocumentUrls);

  // Qualification document URLs - keyed by qualification index
  const initialQualificationDocumentUrls: Record<number, string> = {};
  if (mode === "edit" && (initialData as any)?.qualifications && Array.isArray((initialData as any).qualifications)) {
    (initialData as any).qualifications.forEach((q: any, index: number) => {
      if (q.documentUrl) {
        initialQualificationDocumentUrls[index] = q.documentUrl;
      }
    });
  }
  const [qualificationDocumentUrls, setQualificationDocumentUrls] = useState<Record<number, string>>(initialQualificationDocumentUrls);

  // Update qualificationDocumentUrls when initialData changes
  useEffect(() => {
    if (mode === "edit" && (initialData as any)?.qualifications && Array.isArray((initialData as any).qualifications)) {
      const updatedUrls: Record<number, string> = {};
      (initialData as any).qualifications.forEach((q: any, index: number) => {
        if (q.documentUrl) {
          updatedUrls[index] = q.documentUrl;
        }
      });
      if (Object.keys(updatedUrls).length > 0) {
        setQualificationDocumentUrls(updatedUrls);
      }
    }
  }, [mode, (initialData as any)?.qualifications]);

  // Update documentUrls when initialData changes
  // Same pattern as Equipments & Documents section
  useEffect(() => {
    if (mode === "edit") {
      const updatedUrls: { [key: string]: string } = {};

      // Add EOBI document URL
      if ((initialData as any)?.eobiDocumentUrl) {
        updatedUrls.eobi = (initialData as any).eobiDocumentUrl;
      }

      // Add all other document URLs from documentUrls JSON field
      if ((initialData as any)?.documentUrls && typeof (initialData as any).documentUrls === 'object') {
        const existingDocs = (initialData as any).documentUrls;
        Object.keys(existingDocs).forEach((key) => {
          if (existingDocs[key] && typeof existingDocs[key] === 'string') {
            updatedUrls[key] = existingDocs[key];
          }
        });
      }

      // Add qualification documents to documentUrls object (same pattern)
      if ((initialData as any)?.qualifications && Array.isArray((initialData as any).qualifications)) {
        (initialData as any).qualifications.forEach((q: any, index: number) => {
          if (q.documentUrl) {
            const qualKey = `qualification_${index}`;
            updatedUrls[qualKey] = q.documentUrl;
          }
        });
      }

      if (Object.keys(updatedUrls).length > 0) {
        setDocumentUrls((prev) => ({
          ...prev,
          ...updatedUrls,
        }));
      }
    }
  }, [mode, (initialData as any)?.eobiDocumentUrl, (initialData as any)?.documentUrls, (initialData as any)?.qualifications]);

  // Update qualificationDocumentUrls when initialData changes
  useEffect(() => {
    if (mode === "edit" && (initialData as any)?.qualifications && Array.isArray((initialData as any).qualifications)) {
      const updatedUrls: Record<number, string> = {};
      (initialData as any).qualifications.forEach((q: any, index: number) => {
        if (q.documentUrl) {
          updatedUrls[index] = q.documentUrl;
        }
      });
      if (Object.keys(updatedUrls).length > 0) {
        setQualificationDocumentUrls(updatedUrls);
      }
    }
  }, [mode, (initialData as any)?.qualifications]);

  // Multi-step wizard
  const stepLabels = [
    "Basic Info",
    "Qualification",
    "Contact & Address",
    "Bank & Login",
    "Equipments & Documents",
  ];
  const [step, setStep] = useState(0);

  // Countries state
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  // Fetch countries
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLoadingCountries(true);
        const result = await getCountries();
        if (result.status && result.data) {
          setCountries(result.data.map(c => ({ id: c.id, name: c.name })));
        }
      } catch (error) {
        // Error fetching countries
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // CNIC formatting function
  const formatCNIC = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 5) {
      return digits;
    } else if (digits.length <= 12) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(
        12,
        13
      )}`;
    }
  };

  // Initialize sub-departments when editing with initialData
  useEffect(() => {
    if (mode === "edit" && initialData?.department && departments.length > 0) {
      const deptId = typeof initialData.department === 'string'
        ? initialData.department
        : (initialData.department as any)?.id;
      if (deptId) {
        const selected = departments.find((d) => d.id === deptId);
        if (selected?.subDepartments) {
          setSubDepartments(selected.subDepartments);
        }
      }
    }
  }, [mode, initialData?.department, departments]);

  // Handle sub-departments change
  useEffect(() => {
    if (!department) {
      setSubDepartments([]);
      setValue("subDepartment", "");
      setLoadingSubDepartments(false);
      return;
    }
    const selected = departments.find((d) => d.id === department);
    setSubDepartments(selected?.subDepartments || []);
    setLoadingSubDepartments(false);
  }, [department, departments, setValue]);

  // Auto-select default working hours policy and leaves policy
  useEffect(() => {
    if (mode === "create" && !initialData && workingHoursPolicies.length > 0 && leavesPolicies.length > 0) {
      // Find default working hours policy
      const defaultWorkingHoursPolicy = workingHoursPolicies.find(p => p.isDefault);
      if (defaultWorkingHoursPolicy) {
        const currentValue = watch("workingHoursPolicy");
        if (!currentValue) {
          setValue("workingHoursPolicy", defaultWorkingHoursPolicy.id, { shouldValidate: false });
        }
      }

      // Find default leaves policy
      const defaultLeavesPolicy = leavesPolicies.find(p => p.isDefault);
      if (defaultLeavesPolicy) {
        const currentValue = watch("leavesPolicy");
        if (!currentValue) {
          setValue("leavesPolicy", defaultLeavesPolicy.id, { shouldValidate: false });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingHoursPolicies, leavesPolicies, mode, initialData]);

  // Initialize cities when editing with initialData
  useEffect(() => {
    if (mode === "edit" && initialData?.province && states.length > 0) {
      const stateId = typeof initialData.province === 'string'
        ? initialData.province
        : (initialData.province as any)?.id;
      if (stateId) {
        const fetchCities = async () => {
          try {
            setLoadingCities(true);
            const { getCitiesByState } = await import("@/lib/actions/city");
            const res = await getCitiesByState(stateId);
            if (res.status && res.data) {
              setCities(res.data);
            }
          } catch (error) {
            // Error fetching cities
          } finally {
            setLoadingCities(false);
          }
        };
        fetchCities();
      }
    }
  }, [mode, initialData?.province, states.length]);

  // Handle cities change
  useEffect(() => {
    const run = async () => {
      if (!state) {
        setCities([]);
        setValue("city", "");
        setLoadingCities(false);
        return;
      }
      try {
        setLoadingCities(true);
        const { getCitiesByState } = await import("@/lib/actions/city");
        const res = await getCitiesByState(state);
        if (res.status && res.data) {
          setCities(res.data);
        } else {
          toast.error(res.message || "Failed to load cities");
        }
      } catch {
        toast.error("Failed to load cities");
      } finally {
        setLoadingCities(false);
      }
    };
    const timer = setTimeout(run, 250);
    return () => clearTimeout(timer);
  }, [state, setValue]);

  // Handle profile pic upload
  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    setCropSrc(src);
    setCropDialogOpen(true);
  };

  const onCropComplete = (_: any, areaPixels: any) => setCroppedAreaPixels(areaPixels);

  async function getCroppedBlob(imageSrc: string, area: any): Promise<Blob> {
    const image: HTMLImageElement = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc;
    });
    const canvas = document.createElement('canvas');
    canvas.width = area.width;
    canvas.height = area.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      image,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      area.width,
      area.height
    );
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
  }

  const handleCropDialogClose = (open: boolean) => {
    if (!open) {
      // Reset all crop state when dialog closes
      setCropSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
    setCropDialogOpen(open);
  };

  const confirmCropAndUpload = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const reader = new FileReader();
      reader.onloadend = () => setProfilePicPreview(reader.result as string);
      reader.readAsDataURL(file);
      const uploaded = await uploadFile(file);
      setValue("avatarUrl", uploaded.url);
      toast.success("Profile picture uploaded");

      // Close dialog - state will be reset by handleCropDialogClose
      handleCropDialogClose(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload profile picture");
      // Close dialog even on error
      handleCropDialogClose(false);
    }
  };


  const handleFileChange = async (key: string, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [key]: file }));
    if (file) {
      try {
        const uploaded = await uploadFile(file);

        // Store all documents (including qualification documents) in documentUrls object
        // Same pattern as Equipments & Documents section
        setDocumentUrls((prev) => ({ ...prev, [key]: uploaded.url }));

        // Check if this is a qualification document (format: qualification_0, qualification_1, etc.)
        if (key.startsWith("qualification_")) {
          const index = parseInt(key.replace("qualification_", ""));
          if (!isNaN(index)) {

            // Also update qualificationDocumentUrls for quick access
            setQualificationDocumentUrls((prev) => ({
              ...prev,
              [index]: uploaded.url,
            }));
            // Update form value for this qualification with proper options
            setValue(`qualifications.${index}.documentUrl`, uploaded.url, {
              shouldValidate: false,
              shouldDirty: true,
              shouldTouch: true,
            });
            // Trigger validation to ensure form state is updated
            await trigger(`qualifications.${index}.documentUrl`);
          }
        } else if (key === "eobi") {
          // Handle EOBI document separately
          setValue("eobiDocumentUrl", uploaded.url);
        }
        toast.success("File uploaded");
      } catch (err: any) {
        toast.error(err?.message || "Failed to upload file");
      }
    } else {
      // Handle file removal
      if (key.startsWith("qualification_")) {
        const index = parseInt(key.replace("qualification_", ""));
        if (!isNaN(index)) {
          // Remove from documentUrls
          setDocumentUrls((prev) => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
          // Remove from qualificationDocumentUrls
          setQualificationDocumentUrls((prev) => {
            const updated = { ...prev };
            delete updated[index];
            return updated;
          });
          // Clear form value
          setValue(`qualifications.${index}.documentUrl`, "");
        }
      } else {
        // Remove from documentUrls for other documents
        setDocumentUrls((prev) => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      }
    }
  };

  const RequiredLabel = ({ children }: { children: string }) => {
    const parts = children.split(" *");
    return parts.length > 1 ? (
      <>
        {parts[0]} <span className="text-red-500">*</span>
      </>
    ) : (
      children
    );
  };

  // Validation for each step
  const validateStep = async (currentStep: number) => {
    if (currentStep === 0) {
      const fields = [
        "employeeId",
        "employeeName",
        "fatherHusbandName",
        "department",
        "employeeGrade",
        "attendanceId",
        "designation",
        "maritalStatus",
        "employmentStatus",
        "joiningDate",
        "dateOfBirth",
        "nationality",
        "gender",
        "contactNumber",
        "officialEmail",
        "country",
        "state",
        "city",
        "workingHoursPolicy",
        "leavesPolicy",
        "reportingManager",
        "employeeSalary",
        "cnicNumber",
        "allocation",
      ];

      const results = await Promise.all(
        fields.map(field => trigger(field as keyof EmployeeFormData))
      );

      return results.every(result => result);
    }

    if (currentStep === 1) {
      // Qualification step - no required fields, all optional
      return true;
    }

    if (currentStep === 2) {
      const results = await trigger("officialEmail");
      return results;
    }

    if (currentStep === 3) {
      const fields = ["bankName", "accountNumber", "accountTitle"];
      const results = await Promise.all(
        fields.map(field => trigger(field as keyof EmployeeFormData))
      );
      return results.every(result => result);
    }

    return true;
  };

  const goNext = async () => {
    const isValid = await validateStep(step);
    if (!isValid) {
      toast.error("Please fill required fields in this step");
      return;
    }
    setStep((s) => Math.min(s + 1, stepLabels.length - 1));
  };

  const goBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = async (data: EmployeeFormData) => {
    // Get latest form values including qualification document URLs
    const latestQualifications = watch("qualifications");

    startTransition(async () => {
      try {
        if (mode === "create") {
          // Prepare employee data - use latest watched values for qualifications
          // Same pattern as Equipments & Documents section
          const qualificationsToSubmit = latestQualifications && Array.isArray(latestQualifications) && latestQualifications.length > 0
            ? latestQualifications.map((q: any, index: number) => {
              // Get document URL from documentUrls object (same pattern as other documents)
              const qualKey = `qualification_${index}`;
              const docUrl = documentUrls[qualKey] || q.documentUrl || qualificationDocumentUrls[index] || undefined;
              return {
                qualification: q.qualification || "",
                instituteId: q.instituteId || undefined,
                countryId: q.countryId || undefined,
                stateId: q.stateId || undefined,
                cityId: q.cityId || undefined,
                year: q.year ? String(q.year) : undefined,
                grade: q.grade || undefined,
                documentUrl: docUrl,
              };
            })
            : undefined;

          const employeeData = {
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            fatherHusbandName: data.fatherHusbandName,
            department: data.department,
            subDepartment: data.subDepartment || undefined,
            employeeGrade: data.employeeGrade,
            attendanceId: data.attendanceId,
            designation: data.designation,
            maritalStatus: data.maritalStatus,
            employmentStatus: data.employmentStatus,
            probationExpiryDate: data.probationExpiryDate || undefined,
            cnicNumber: data.cnicNumber,
            cnicExpiryDate: data.cnicExpiryDate || undefined,
            lifetimeCnic: data.lifetimeCnic,
            joiningDate: data.joiningDate,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            gender: data.gender,
            contactNumber: data.contactNumber,
            emergencyContactNumber: data.emergencyContactNumber || undefined,
            emergencyContactPersonName:
              data.emergencyContactPersonName || undefined,
            personalEmail: data.personalEmail || undefined,
            officialEmail: data.officialEmail,
            country: data.country,
            state: data.state,
            city: data.city,
            employeeSalary: data.employeeSalary,
            eobi: data.eobi,
            eobiId: data.eobiId || undefined,
            eobiCode: data.eobiCode || undefined,
            eobiNumber: data.eobiNumber || undefined,
            providentFund: data.providentFund,
            overtimeApplicable: data.overtimeApplicable,
            daysOff: data.daysOff || undefined,
            reportingManager: data.reportingManager || "",
            workingHoursPolicy: data.workingHoursPolicy,
            location: data.location,
            allocation: data.allocation,
            leavesPolicy: data.leavesPolicy,
            allowRemoteAttendance: data.allowRemoteAttendance,
            currentAddress: data.currentAddress || undefined,
            permanentAddress: data.permanentAddress || undefined,
            bankName: data.bankName || "",
            accountNumber: data.accountNumber || "",
            accountTitle: data.accountTitle || "",
            socialSecurityInstitutionId: data.socialSecurityInstitutionId || undefined,
            equipmentAssignments: data.equipmentAssignments,
            avatarUrl: data.avatarUrl || undefined,
            eobiDocumentUrl: data.eobiDocumentUrl || undefined,
            documentUrls: Object.keys(documentUrls).length > 0 ? documentUrls : undefined,
            qualifications: qualificationsToSubmit,
            socialSecurityRegistrations: data.socialSecurityRegistrations && Array.isArray(data.socialSecurityRegistrations) && data.socialSecurityRegistrations.length > 0
              ? data.socialSecurityRegistrations.map((reg: any) => ({
                institutionId: reg.institutionId,
                registrationNumber: reg.registrationNumber || undefined,
                cardNumber: reg.cardNumber || undefined,
                registrationDate: reg.registrationDate || undefined,
                expiryDate: reg.expiryDate || undefined,
                contributionRate: reg.contributionRate ? parseFloat(String(reg.contributionRate)) : undefined,
                baseSalary: reg.baseSalary ? parseFloat(String(reg.baseSalary)) : undefined,
                monthlyContribution: reg.monthlyContribution ? parseFloat(String(reg.monthlyContribution)) : undefined,
                status: reg.status || "active",
              }))
              : undefined,
          };

          const result = await createEmployee(employeeData);

          if (result.status) {
            toast.success(result.message || "Employee created successfully");
            startTransition(() => {
              addTransitionType("nav-back");
              router.push("/hr/employee/list");
            });
          } else {
            toast.error(result.message || "Failed to create employee");
          }
        } else if (mode === "rejoin" && cnic && onRejoinSubmit) {
          // Rejoin mode - prepare data for rejoin API
          const rejoinData = {
            cnic: cnic,
            employeeId: data.employeeId,
            attendanceId: data.attendanceId,
            joiningDate: data.joiningDate,
            employeeName: data.employeeName,
            fatherHusbandName: data.fatherHusbandName,
            department: data.department,
            subDepartment: data.subDepartment || undefined,
            employeeGrade: data.employeeGrade,
            designation: data.designation,
            maritalStatus: data.maritalStatus,
            employmentStatus: data.employmentStatus,
            probationExpiryDate: data.probationExpiryDate || undefined,
            cnicExpiryDate: data.cnicExpiryDate || undefined,
            lifetimeCnic: data.lifetimeCnic,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            gender: data.gender,
            contactNumber: data.contactNumber,
            emergencyContactNumber: data.emergencyContactNumber || undefined,
            emergencyContactPersonName: data.emergencyContactPersonName || undefined,
            personalEmail: data.personalEmail || undefined,
            officialEmail: data.officialEmail || undefined,
            country: data.country,
            state: data.state,
            city: data.city,
            employeeSalary: data.employeeSalary,
            eobi: data.eobi,
            eobiId: data.eobiId || undefined,
            eobiCode: data.eobiCode || undefined,
            eobiNumber: data.eobiNumber || undefined,
            providentFund: data.providentFund,
            overtimeApplicable: data.overtimeApplicable,
            daysOff: data.daysOff || undefined,
            reportingManager: data.reportingManager || "",
            workingHoursPolicy: data.workingHoursPolicy,
            location: data.location,
            allocation: data.allocation,
            leavesPolicy: data.leavesPolicy,
            allowRemoteAttendance: data.allowRemoteAttendance,
            currentAddress: data.currentAddress || undefined,
            permanentAddress: data.permanentAddress || undefined,
            bankName: data.bankName || "",
            accountNumber: data.accountNumber || "",
            accountTitle: data.accountTitle || "",
            socialSecurityInstitutionId: data.socialSecurityInstitutionId || undefined,
            equipmentAssignments: data.equipmentAssignments,
            avatarUrl: data.avatarUrl || undefined,
            eobiDocumentUrl: data.eobiDocumentUrl || undefined,
            documentUrls: Object.keys(documentUrls).length > 0 ? documentUrls : undefined,
          };

          await onRejoinSubmit(rejoinData);
        } else if (mode === "edit" && initialData) {
          // Get latest form values including qualification document URLs
          // Same pattern as Equipments & Documents section
          const latestQualifications = watch("qualifications");
          const qualificationsToSubmit = latestQualifications && Array.isArray(latestQualifications) && latestQualifications.length > 0
            ? latestQualifications.map((q: any, index: number) => {
              // Get document URL from documentUrls object (same pattern as other documents)
              const qualKey = `qualification_${index}`;
              const docUrl = documentUrls[qualKey] || q.documentUrl || qualificationDocumentUrls[index] || undefined;
              return {
                qualification: q.qualification || "",
                instituteId: q.instituteId || undefined,
                countryId: q.countryId || undefined,
                stateId: q.stateId || undefined,
                cityId: q.cityId || undefined,
                year: q.year ? String(q.year) : undefined,
                grade: q.grade || undefined,
                documentUrl: docUrl,
              };
            })
            : undefined;

          const employeeData = {
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            fatherHusbandName: data.fatherHusbandName,
            department: data.department,
            subDepartment: data.subDepartment || undefined,
            employeeGrade: data.employeeGrade,
            attendanceId: data.attendanceId,
            designation: data.designation,
            maritalStatus: data.maritalStatus,
            employmentStatus: data.employmentStatus,
            probationExpiryDate: data.probationExpiryDate || undefined,
            cnicNumber: data.cnicNumber,
            cnicExpiryDate: data.cnicExpiryDate || undefined,
            lifetimeCnic: data.lifetimeCnic,
            joiningDate: data.joiningDate,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            gender: data.gender,
            contactNumber: data.contactNumber,
            emergencyContactNumber: data.emergencyContactNumber || undefined,
            emergencyContactPersonName:
              data.emergencyContactPersonName || undefined,
            personalEmail: data.personalEmail || undefined,
            officialEmail: data.officialEmail || undefined,
            country: data.country,
            state: data.state,
            city: data.city,
            employeeSalary: parseFloat(data.employeeSalary) || 0,
            eobi: data.eobi,
            eobiId: data.eobiId || undefined,
            eobiCode: data.eobiCode || undefined,
            eobiNumber: data.eobiNumber || undefined,
            providentFund: data.providentFund,
            overtimeApplicable: data.overtimeApplicable,
            daysOff: data.daysOff || undefined,
            reportingManager: data.reportingManager,
            workingHoursPolicy: data.workingHoursPolicy,
            location: data.location,
            allocation: data.allocation,
            leavesPolicy: data.leavesPolicy,
            allowRemoteAttendance: data.allowRemoteAttendance,
            currentAddress: data.currentAddress || undefined,
            permanentAddress: data.permanentAddress || undefined,
            bankName: data.bankName || "",
            accountNumber: data.accountNumber || "",
            accountTitle: data.accountTitle || "",
            socialSecurityInstitutionId: data.socialSecurityInstitutionId || undefined,
            equipmentAssignments: data.equipmentAssignments,
            avatarUrl: data.avatarUrl || undefined,
            eobiDocumentUrl: data.eobiDocumentUrl || undefined,
            documentUrls: Object.keys(documentUrls).length > 0 ? documentUrls : undefined,
            qualifications: qualificationsToSubmit,
            socialSecurityRegistrations: data.socialSecurityRegistrations && Array.isArray(data.socialSecurityRegistrations) && data.socialSecurityRegistrations.length > 0
              ? data.socialSecurityRegistrations.map((reg: any) => ({
                institutionId: reg.institutionId,
                registrationNumber: reg.registrationNumber || undefined,
                cardNumber: reg.cardNumber || undefined,
                registrationDate: reg.registrationDate || undefined,
                expiryDate: reg.expiryDate || undefined,
                contributionRate: reg.contributionRate ? parseFloat(String(reg.contributionRate)) : undefined,
                baseSalary: reg.baseSalary ? parseFloat(String(reg.baseSalary)) : undefined,
                monthlyContribution: reg.monthlyContribution ? parseFloat(String(reg.monthlyContribution)) : undefined,
                status: reg.status || "active",
              }))
              : [],
          };

          const result = await updateEmployee(initialData.id, employeeData as any);

          if (result.status) {
            toast.success(result.message || "Employee updated successfully");
            startTransition(() => {
              addTransitionType("nav-back");
              router.push("/hr/employee/list");
            });
          } else {
            toast.error(result.message || "Failed to update employee");
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : mode === "create"
            ? "Failed to create employee. Please check console for details."
            : "Failed to update employee. Please check console for details.";
        toast.error(errorMessage);
      }
    });
  };

  return (
    <FormProvider {...form}>
      <div className="max-w-6xl mx-auto pb-10">

        <div className="rounded-2xl bg-card shadow-sm p-6">
          <form
            onSubmit={handleSubmit(
              onSubmit,
              (errors) => {
                toast.error("Please fix all validation errors before submitting");
              }
            )}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              {stepLabels.map((label, idx) => {
                const isActive = idx === step;
                const isDone = idx < step;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${isActive
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : isDone
                        ? "bg-muted text-foreground ring-1 ring-border"
                        : "bg-muted text-muted-foreground ring-1 ring-border"
                      }`}
                  >
                    <span className="h-6 w-6 rounded-full bg-background border flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>

            {step === 0 && (
              <>
                {/* Profile Picture Upload */}
                <Card className="border-0 shadow-none bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      Profile Picture
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center gap-6">
                      <div
                        className="relative cursor-pointer group"
                        onClick={() => document.getElementById("profile-pic-input")?.click()}
                      >
                        {profilePicPreview ? (
                          <img
                            src={profilePicPreview}
                            alt="Profile preview"
                            className="w-40 h-40 rounded-full object-cover border-4 border-border group-hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              setProfilePicPreview(null);
                            }}
                          />
                        ) : (
                          <div className="w-40 h-40 rounded-full bg-muted flex items-center justify-center border-4 border-border group-hover:bg-muted/80 transition-colors">
                            <img
                              src="/profileicon.svg"
                              alt="Default profile"
                              className="w-20 h-20 dark:invert"
                            />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                      </div>
                      <input
                        id="profile-pic-input"
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePicChange}
                        className="hidden"
                        disabled={isPending}
                      />
                    </div>
                    <Dialog open={cropDialogOpen} onOpenChange={handleCropDialogClose}>
                      <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                          <DialogTitle>Crop Profile Picture</DialogTitle>
                        </DialogHeader>
                        <div className="relative w-full h-80 bg-muted rounded-md overflow-hidden">
                          {cropSrc && (
                            <Cropper
                              image={cropSrc}
                              crop={crop}
                              zoom={zoom}
                              aspect={1}
                              onCropChange={setCrop}
                              onZoomChange={setZoom}
                              onCropComplete={onCropComplete}
                            />
                          )}
                        </div>
                        <DialogFooter>
                          <div className="flex w-full justify-end gap-2">
                            <Button variant="outline" onClick={() => handleCropDialogClose(false)}>Cancel</Button>
                            <Button onClick={confirmCropAndUpload}>Save</Button>
                          </div>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>


                {/* Basic Information */}
                <Card className="border-0 shadow-none bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      Basic Information
                    </CardTitle>
                    <CardDescription>Enter employee&apos;s basic details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BasicInfoSection
                      form={form}
                      isPending={isPending}
                      loadingData={loadingData}
                      departments={departments}
                      subDepartments={subDepartments}
                      department={department}
                      loadingSubDepartments={loadingSubDepartments}
                      employeeGrades={employeeGrades}
                      designations={designations}
                      maritalStatuses={maritalStatuses}
                      employeeStatuses={employeeStatuses}
                      errors={errors}
                      formatCNIC={formatCNIC}
                      nationalities={nationalities}
                      genders={genders}
                      states={states}
                      cities={cities}
                      state={state}
                      loadingCities={loadingCities}
                      daysOff={daysOff}
                      workingHoursPolicies={workingHoursPolicies}
                      locations={locations}
                      allocations={allocations}
                      leavesPolicies={leavesPolicies}
                      documents={documents}
                      handleFileChange={handleFileChange}
                      employees={employees}
                      documentUrls={documentUrls}
                      mode={mode}
                    />
                    <DateSection form={form} isPending={isPending} errors={errors} />
                  </CardContent>
                </Card>
              </>
            )}

            {step === 1 && (
              <>
                {/* Qualification Section */}
                <Card className="border-0 shadow-none bg-muted/50">
                  <CardHeader>
                    {/* <CardTitle className="text-lg font-semibold">
                    Qualifications
                  </CardTitle>
                  <CardDescription>Add employee qualifications</CardDescription> */}
                  </CardHeader>
                  <CardContent>
                    <QualificationSection
                      form={form}
                      isPending={isPending}
                      loadingData={loadingData}
                      qualifications={(qualifications || []).map(q => ({ id: q.id, name: q.name }))}
                      institutes={(institutes || []).map(i => ({ id: i.id, name: i.name }))}
                      states={states.map(s => ({ id: s.id, name: s.name }))}
                      cities={cities.map(c => ({ id: c.id, name: c.name, stateId: (c as any).stateId }))}
                      errors={errors}
                      onQualificationAdded={onQualificationAdded}
                      onInstituteAdded={onInstituteAdded}
                      handleFileChange={handleFileChange}
                      qualificationDocumentUrls={qualificationDocumentUrls}
                      documentUrls={documentUrls}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {step === 2 && (
              <>
                {/* Address Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Address Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Current Address</Label>
                      <Textarea
                        placeholder="(e.g., House No. 123, Street Name, City, Province)"
                        {...register("currentAddress")}
                        disabled={isPending}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Permanent Address</Label>
                      <Textarea
                        placeholder="(e.g., House No. 456, Street Name, City, Province)"
                        {...register("permanentAddress")}
                        disabled={isPending}
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {step === 3 && (
              <>
                {/* Bank Account Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Bank Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Controller
                        name="bankName"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isPending}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {bankList.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {b}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.bankName && (
                        <p className="text-xs text-red-500">{errors.bankName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input
                        {...register("accountNumber")}
                        disabled={isPending}
                      />
                      {errors.accountNumber && (
                        <p className="text-xs text-red-500">{errors.accountNumber.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Account Title</Label>
                      <Input
                        {...register("accountTitle")}
                        disabled={isPending}
                      />
                      {errors.accountTitle && (
                        <p className="text-xs text-red-500">{errors.accountTitle.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Social Security Institution</Label>
                      <Controller
                        name="socialSecurityInstitutionId"
                        control={control}
                        render={({ field }) => (
                          <Autocomplete
                            options={socialSecurityInstitutions.map((i: any) => ({
                              value: i.id,
                              label: i.name,
                            }))}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select Institution"
                            disabled={isPending}
                          />
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Social Security Registration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Social Security Registration</CardTitle>
                    <CardDescription>
                      Register employee with SESSI, PESSE, IESSI or other social security institutions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SocialSecuritySection
                      form={form}
                      isPending={isPending}
                      loadingData={loadingData}
                      socialSecurityInstitutions={socialSecurityInstitutions}
                      errors={errors}
                    />
                  </CardContent>
                </Card>

              </>
            )}

            {step === 4 && (
              <>
                {/* Employee Items Issued */}
                <EquipmentSection
                  equipments={equipments}
                  disabled={isPending || loadingData}
                />

                {/* Document Uploads */}
                <Card>
                  <CardHeader>
                    <CardTitle>Employee Document Uploads</CardTitle>
                    <CardDescription>Upload required documents</CardDescription>
                  </CardHeader>

                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col items-center">
                      <Label className="text-center">Upload CV</Label>
                      <FileUpload
                        id="cv"
                        onChange={(files) => handleFileChange("cv", files?.[0] || null)}
                        existingFileUrl={documentUrls.cv}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Upload Passport Size Photos (2)</Label>
                      <FileUpload
                        id="passportPhotos"
                        onChange={(files) =>
                          handleFileChange("passportPhotos", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.passportPhotos}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Upload CNIC</Label>
                      <FileUpload
                        id="cnic"
                        onChange={(files) => handleFileChange("cnic", files?.[0] || null)}
                        existingFileUrl={documentUrls.cnic}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Clearance Letter (if any)</Label>
                      <FileUpload
                        id="clearanceLetter"
                        onChange={(files) =>
                          handleFileChange("clearanceLetter", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.clearanceLetter}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Fit & Proper Criteria Form</Label>
                      <FileUpload
                        id="fitProperCriteria"
                        onChange={(files) =>
                          handleFileChange("fitProperCriteria", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.fitProperCriteria}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Affirmation – Company Service Rules</Label>
                      <FileUpload
                        id="serviceRulesAffirmation"
                        onChange={(files) =>
                          handleFileChange("serviceRulesAffirmation", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.serviceRulesAffirmation}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Affirmation – VIS Code of Conduct 2019</Label>
                      <FileUpload
                        id="codeOfConduct"
                        onChange={(files) =>
                          handleFileChange("codeOfConduct", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.codeOfConduct}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Upload Non-Disclosure Agreement (NDA)</Label>
                      <FileUpload
                        id="nda"
                        onChange={(files) => handleFileChange("nda", files?.[0] || null)}
                        existingFileUrl={documentUrls.nda}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Information Secrecy / Confidentiality Form</Label>
                      <FileUpload
                        id="secrecyForm"
                        onChange={(files) =>
                          handleFileChange("secrecyForm", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.secrecyForm}
                      />
                    </div>

                    <div className="flex flex-col items-center">
                      <Label className="text-center">Investment Disclosure Form</Label>
                      <FileUpload
                        id="investmentDisclosure"
                        onChange={(files) =>
                          handleFileChange("investmentDisclosure", files?.[0] || null)
                        }
                        existingFileUrl={documentUrls.investmentDisclosure}
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Submit / Navigation Buttons */}
            <div className="flex gap-2 justify-end">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  disabled={isPending}
                >
                  Back
                </Button>
              )}
              {step < stepLabels.length - 1 && (
                <Button type="button" onClick={goNext} disabled={isPending}>
                  Next
                </Button>
              )}
              {step === stepLabels.length - 1 && (
                <Button
                  type="submit"
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {mode === "create" ? "Create Employee" : "Update Employee"}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </FormProvider>
  );
}
