'use server';
import { authFetch } from '@/lib/auth';
export interface WorkingHoursPolicy {
  id: string;
  name: string;
  startWorkingHours: string;
  endWorkingHours: string;
  shortDayMins?: number | null;
  startBreakTime?: string | null;
  endBreakTime?: string | null;
  halfDayStartTime?: string | null;
  lateStartTime?: string | null;
  lateDeductionType?: string | null;
  applyDeductionAfterLates?: number | null;
  lateDeductionPercent?: number | null;
  halfDayDeductionType?: string | null;
  applyDeductionAfterHalfDays?: number | null;
  halfDayDeductionAmount?: number | null;
  shortDayDeductionType?: string | null;
  applyDeductionAfterShortDays?: number | null;
  shortDayDeductionAmount?: number | null;
  overtimeRate?: number | null;
  gazzetedOvertimeRate?: number | null;
  dayOverrides?:
  | Array<{
    days: string[];
    enabled: boolean;
    overrideHours: boolean;
    startTime: string;
    endTime: string;
    overrideBreak: boolean;
    startBreakTime: string;
    endBreakTime: string;
    dayType: "full" | "half" | "custom";
  }>
  | {
    [key: string]: {
      enabled: boolean;
      overrideHours: boolean;
      startTime: string;
      endTime: string;
      overrideBreak: boolean;
      startBreakTime: string;
      endBreakTime: string;
      dayType: "full" | "half" | "custom";
    };
  }
  | null;
  status: string;
  isDefault?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
// Get all working hours policies
export async function getWorkingHoursPolicies(): Promise<{ status: boolean; data?: WorkingHoursPolicy[]; message?: string }> {
  try {
    const res = await authFetch(`/working-hours-policies`, {
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching working hours policies:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch working hours policies. Please check your connection.'
    };
  }
}
// Get working hours policy by id
export async function getWorkingHoursPolicyById(id: string): Promise<{ status: boolean; data?: WorkingHoursPolicy; message?: string }> {
  try {
    const res = await authFetch(`/working-hours-policies/${id}`, {
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching working hours policy:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch working hours policy'
    };
  }
}
// Create working hours policy
export async function createWorkingHoursPolicy(data: {
  name: string;
  startWorkingHours: string;
  endWorkingHours: string;
  shortDayMins?: number | null;
  startBreakTime?: string | null;
  endBreakTime?: string | null;
  halfDayStartTime?: string | null;
  lateStartTime?: string | null;
  lateDeductionType?: string | null;
  applyDeductionAfterLates?: number | null;
  lateDeductionPercent?: number | null;
  halfDayDeductionType?: string | null;
  applyDeductionAfterHalfDays?: number | null;
  halfDayDeductionAmount?: number | null;
  shortDayDeductionType?: string | null;
  applyDeductionAfterShortDays?: number | null;
  shortDayDeductionAmount?: number | null;
  overtimeRate?: number | null;
  gazzetedOvertimeRate?: number | null;
  status?: string;
  dayOverrides?:
  | Array<{
    days: string[];
    enabled: boolean;
    overrideHours: boolean;
    startTime: string;
    endTime: string;
    overrideBreak: boolean;
    startBreakTime: string;
    endBreakTime: string;
    dayType: "full" | "half" | "custom";
  }>
  | {
    [key: string]: {
      enabled: boolean;
      overrideHours: boolean;
      startTime: string;
      endTime: string;
      overrideBreak: boolean;
      startBreakTime: string;
      endBreakTime: string;
      dayType: "full" | "half" | "custom";
    };
  }
  | null;
}): Promise<{ status: boolean; data?: WorkingHoursPolicy; message?: string }> {
  try {
    const res = await authFetch(`/working-hours-policies`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating working hours policy:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create working hours policy' };
  }
}
// Update working hours policy
export async function updateWorkingHoursPolicy(id: string, data: {
  name: string;
  startWorkingHours: string;
  endWorkingHours: string;
  shortDayMins?: number | null;
  startBreakTime?: string | null;
  endBreakTime?: string | null;
  halfDayStartTime?: string | null;
  lateStartTime?: string | null;
  lateDeductionType?: string | null;
  applyDeductionAfterLates?: number | null;
  lateDeductionPercent?: number | null;
  halfDayDeductionType?: string | null;
  applyDeductionAfterHalfDays?: number | null;
  halfDayDeductionAmount?: number | null;
  shortDayDeductionType?: string | null;
  applyDeductionAfterShortDays?: number | null;
  shortDayDeductionAmount?: number | null;
  overtimeRate?: number | null;
  gazzetedOvertimeRate?: number | null;
  status?: string;
  dayOverrides?:
  | Array<{
    days: string[];
    enabled: boolean;
    overrideHours: boolean;
    startTime: string;
    endTime: string;
    overrideBreak: boolean;
    startBreakTime: string;
    endBreakTime: string;
    dayType: "full" | "half" | "custom";
  }>
  | {
    [key: string]: {
      enabled: boolean;
      overrideHours: boolean;
      startTime: string;
      endTime: string;
      overrideBreak: boolean;
      startBreakTime: string;
      endBreakTime: string;
      dayType: "full" | "half" | "custom";
    };
  }
  | null;
}): Promise<{ status: boolean; data?: WorkingHoursPolicy; message?: string }> {
  try {
    const res = await authFetch(`/working-hours-policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating working hours policy:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update working hours policy' };
  }
}
// Delete working hours policy
export async function deleteWorkingHoursPolicy(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/working-hours-policies/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting working hours policy:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete working hours policy' };
  }
}
// ==================== Policy Assignments ====================
export interface PolicyAssignment {
  id: string;
  employeeId: string;
  workingHoursPolicyId: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeId: string;
    employeeName: string;
    departmentId?: string;
  };
  workingHoursPolicy?: {
    id: string;
    name: string;
    startWorkingHours: string;
    endWorkingHours: string;
  };
}
// Get policy assignments for an employee
export async function getEmployeePolicyAssignments(employeeId: string): Promise<{ status: boolean; data?: PolicyAssignment[]; message?: string }> {
  try {
    const res = await authFetch(`/employees/${employeeId}/policy-assignments`, {
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching policy assignments:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch policy assignments',
    };
  }
}
// Get all policy assignments with optional filters
export async function getPolicyAssignments(filters?: { employeeId?: string; policyId?: string }): Promise<{ status: boolean; data?: PolicyAssignment[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.policyId) params.append('policyId', filters.policyId);
    const res = await authFetch(`/working-hours-policy-assignments?${params.toString()}`, {
    });
    if (!res.ok) {
      const errorData = res.data;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching policy assignments:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch policy assignments',
    };
  }
}
// Create policy assignment
export async function createPolicyAssignment(data: {
  employeeId: string;
  workingHoursPolicyId: string;
  startDate: string | Date;
  endDate: string | Date;
  notes?: string;
}): Promise<{ status: boolean; data?: PolicyAssignment; message?: string }> {
  try {
    const payload = {
      ...data,
      startDate: data.startDate instanceof Date ? data.startDate.toISOString() : data.startDate,
      endDate: data.endDate instanceof Date ? data.endDate.toISOString() : data.endDate,
    };
    const res = await authFetch(`/working-hours-policy-assignments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create policy assignment' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating policy assignment:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create policy assignment' };
  }
}
// Update policy assignment
export async function updatePolicyAssignment(
  id: string,
  data: {
    startDate?: string | Date;
    endDate?: string | Date;
    notes?: string;
  }
): Promise<{ status: boolean; data?: PolicyAssignment; message?: string }> {
  try {
    const payload: any = { ...data };
    if (data.startDate) {
      payload.startDate = data.startDate instanceof Date ? data.startDate.toISOString() : data.startDate;
    }
    if (data.endDate) {
      payload.endDate = data.endDate instanceof Date ? data.endDate.toISOString() : data.endDate;
    }
    const res = await authFetch(`/working-hours-policy-assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update policy assignment' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating policy assignment:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update policy assignment' };
  }
}
// Delete policy assignment
export async function deletePolicyAssignment(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/working-hours-policy-assignments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete policy assignment' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting policy assignment:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete policy assignment' };
  }
}
