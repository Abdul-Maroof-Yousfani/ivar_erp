"use server";
import { authFetch } from "@/lib/auth";

export interface SocialSecurityEmployee {
  id: string;
  registrationNumber: string;
  baseSalary: string | number;
  monthlyContribution: string | number;
  status: string;
  employee: {
    id: string;
    employeeId: string;
    employeeName: string;
    department: {
      id: string;
      name: string;
    } | null;
  };
  institution: {
    id: string;
    name: string;
    code: string;
  };
}

export async function getSocialSecurityEmployees(): Promise<{ status: boolean; data?: SocialSecurityEmployee[]; message?: string }> {
  try {
    const [registrationsResponse, contributionsResponse] = await Promise.all([
      authFetch(`/social-security-employee-registrations`, {
        method: "GET",
      }),
      authFetch(`/social-security-contributions`, {
        method: "GET",
      }),
    ]);
    if (!registrationsResponse.ok) {
      const errorData = registrationsResponse.data || { message: "Failed to fetch Social Security employees" };
      return {
        status: false,
        message: errorData.message || `HTTP error! status: ${registrationsResponse.status}`,
      };
    }
    const registrationsResult = registrationsResponse.data;
    const registrations: SocialSecurityEmployee[] = registrationsResult.data || [];
    let contributions: any[] = [];
    if (contributionsResponse.ok) {
      const contributionsResult = contributionsResponse.data || { data: [] };
      contributions = contributionsResult.data || [];
    }
    const totalContributionByRegistration = new Map<string, number>();
    const totalContributionByEmployeeId = new Map<string, number>();

    for (const contrib of contributions) {
      const amount = Number(contrib.contributionAmount || 0);
      if (contrib.employeeRegistrationId) {
        const curr = totalContributionByRegistration.get(contrib.employeeRegistrationId) || 0;
        totalContributionByRegistration.set(contrib.employeeRegistrationId, curr + amount);
      }
      if (contrib.employeeId) {
        const curr = totalContributionByEmployeeId.get(contrib.employeeId) || 0;
        totalContributionByEmployeeId.set(contrib.employeeId, curr + amount);
      }
    }

    const enrichedRegistrations = registrations.map((reg) => {
      const totalAmount =
        totalContributionByRegistration.get(reg.id) ??
        totalContributionByEmployeeId.get(reg.employeeId);

      return {
        ...reg,
        monthlyContribution:
          totalAmount !== undefined && totalAmount > 0
            ? totalAmount
            : Number(reg.monthlyContribution || 0),
      };
    });
    return { status: true, data: enrichedRegistrations };
  } catch (error) {
    console.error("Error fetching Social Security employees:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}