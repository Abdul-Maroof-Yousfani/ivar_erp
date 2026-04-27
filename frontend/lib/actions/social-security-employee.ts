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
    const latestContributionByRegistration = new Map<string, any>();
    for (const contrib of contributions) {
      const registrationId = contrib.employeeRegistrationId as string | undefined;
      if (!registrationId) continue;
      const existing = latestContributionByRegistration.get(registrationId);
      if (!existing) {
        latestContributionByRegistration.set(registrationId, contrib);
        continue;
      }
      const existingDate = new Date(existing.date || existing.createdAt);
      const currentDate = new Date(contrib.date || contrib.createdAt);
      if (currentDate > existingDate) {
        latestContributionByRegistration.set(registrationId, contrib);
      }
    }
    const enrichedRegistrations = registrations.map((reg) => {
      const contrib = latestContributionByRegistration.get(reg.id);
      if (!contrib) return reg;
      return {
        ...reg,
        monthlyContribution: contrib.contributionAmount,
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