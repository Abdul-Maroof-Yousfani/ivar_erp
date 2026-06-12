import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

export async function GET() {
  try {
    const token = await getAccessToken();
    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const [depts, grades, designations, marital, statuses, locations, states, equipments, workingHours, leaves, qualifications, institutes, socialSecurity, allocations] = await Promise.all([
      fetch(`${API_BASE}/departments`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/employee-grades`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/designations`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/marital-statuses`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/employee-statuses`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/locations`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/states`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/equipments`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/working-hours-policies`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/leaves-policies`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/qualifications`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/institutes`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/social-security-institutions`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
      fetch(`${API_BASE}/allocations`, { headers, cache: "no-store" }).then(r => r.json()).catch(() => ({ status: false, data: [] })),
    ]);
    
    // console.log(`[API Data] socialSecurityInstitutions length: ${socialSecurity.data?.length || 0}`);

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
      },
    });
  } catch (error: any) {
    return NextResponse.json({ status: false, message: error?.message || "Failed to load data" }, { status: 500 });
  }
}
