'use server';
import { authFetch } from '@/lib/auth';

export interface DeductionHead {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deduction {
  id: string;
  employeeId: string;
  employeeName?: string;
  employee?: {
    id: string;
    employeeId: string;
    employeeName: string;
    department?: {
      id: string;
      name: string;
    };
    subDepartment?: {
      id: string;
      name: string;
    };
  };
  deductionHeadId: string;
  deductionHeadName?: string;
  deductionHead?: {
    id: string;
    name: string;
  };
  amount: number | string;
  date: string;
  month?: string;
  year?: string;
  isTaxable?: boolean;
  taxPercentage?: number | string | null;
  notes?: string;
  status?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

// Get all deduction heads
export async function getDeductionHeads(): Promise<{ status: boolean; data?: DeductionHead[]; message?: string }> {
  try {
    const res = await authFetch(`/deduction-heads`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch deduction heads' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching deduction heads:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch deduction heads. Please check your connection.'
    };
  }
}

// Create deduction (single)
export async function createDeduction(data: {
  employeeId: string;
  deductionHeadId: string;
  amount: number;
  date: string;
  month?: string;
  year?: string;
  notes?: string;
  isTaxable?: boolean;
  taxPercentage?: number;
}): Promise<{ status: boolean; data?: Deduction; message?: string }> {
  try {
    const res = await authFetch(`/deductions`, {
      method: 'POST',
      body: JSON.stringify({
        month: data.month,
        year: data.year,
        date: data.date,
        deductions: [{
          employeeId: data.employeeId,
          deductionHeadId: data.deductionHeadId,
          amount: data.amount,
          notes: data.notes,
          isTaxable: data.isTaxable,
          taxPercentage: data.taxPercentage,
        }],
      }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create deduction' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    return { status: result.status, data: result.data?.[0], message: result.message };
  } catch (error) {
    console.error('Error creating deduction:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create deduction' };
  }
}

// Bulk create deductions
export async function bulkCreateDeductions(data: {
  month: string;
  year: string;
  date: string;
  deductions: Array<{
    employeeId: string;
    deductionHeadId: string;
    amount: number;
    notes?: string;
    isTaxable?: boolean;
    taxPercentage?: number;
  }>;
}): Promise<{ status: boolean; data?: Deduction[]; message?: string }> {
  try {
    const res = await authFetch(`/deductions/bulk`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create deductions' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating deductions:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create deductions' };
  }
}

// Get all deductions
export async function getDeductions(params?: {
  employeeId?: string;
  deductionHeadId?: string;
  month?: string;
  year?: string;
}): Promise<{ status: boolean; data?: Deduction[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params?.deductionHeadId) queryParams.append('deductionHeadId', params.deductionHeadId);
    if (params?.month) queryParams.append('month', params.month);
    if (params?.year) queryParams.append('year', params.year);
    const res = await authFetch(`/deductions?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch deductions' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching deductions:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch deductions. Please check your connection.'
    };
  }
}

// Update deduction
export async function updateDeduction(id: string, data: {
  employeeId?: string;
  deductionHeadId?: string;
  amount?: number;
  date?: string;
  month?: string;
  year?: string;
  notes?: string;
  isTaxable?: boolean;
  taxPercentage?: number | null;
  status?: string;
}): Promise<{ status: boolean; data?: Deduction; message?: string }> {
  try {
    const res = await authFetch(`/deductions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update deduction' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating deduction:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update deduction' };
  }
}

// Delete deduction
export async function deleteDeduction(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/deductions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete deduction' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting deduction:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete deduction' };
  }
}