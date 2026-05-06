import { NextResponse } from "next/server";
import { authFetch } from "@/lib/auth";

export async function GET() {
  try {
    const options = { cache: "no-store" };
    const [
      depts,
      grades,
      designations,
      marital,
      statuses,
      locations,
      states,
      equipments,
      workingHours,
      leaves,
      qualifications,
      institutes,
      socialSecurity,
      allocations,
      banks,
    ] = await Promise.all([
      authFetch("/departments", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/employee-grades", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/designations", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/marital-statuses", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/employee-statuses", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/locations", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/states", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/equipments", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/working-hours-policies", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/leaves-policies", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/qualifications", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/institutes", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/social-security-institutions", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/allocations", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
      authFetch("/banks", options)
        .then((r) => r.data)
        .catch(() => ({ status: false, data: [] })),
    ]);

    return NextResponse.json({
      status: true,
      data: {
        departments: depts.data || [],
        employeeGrades: grades.data || [],
        designations: designations.data || [],
        maritalStatuses: marital.data || [],
        employeeStatuses: statuses.data || [],
        locations: locations.data || [],
        states: states.data || [],
        equipments: equipments.data || [],
        workingHoursPolicies: workingHours.data || [],
        leavesPolicies: leaves.data || [],
        qualifications: qualifications.data || [],
        institutes: institutes.data || [],
        socialSecurityInstitutions: socialSecurity.data || [],
        allocations: allocations.data || [],
        banks: banks.data || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ status: false, message: error?.message || "Failed to load data" }, { status: 500 });
  }
}
