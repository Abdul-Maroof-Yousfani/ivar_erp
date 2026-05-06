'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface Increment {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  employeeGradeId?: string;
  employeeGradeName?: string;
  designationId?: string;
  designationName?: string;
  department?: string;
  subDepartment?: string;
  incrementType: 'Increment' | 'Decrement';
  incrementAmount?: number;
  incrementPercentage?: number;
  incrementMethod: 'Amount' | 'Percent';
  salary: number;
  promotionDate: string;
  currentMonth: string;
  notes?: string;
  status?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIncrementData {
  employeeId: string;
  employeeGradeId?: string;
  designationId?: string;
  incrementType: 'Increment' | 'Decrement';
  incrementAmount?: number;
  incrementPercentage?: number;
  incrementMethod: 'Amount' | 'Percent';
  salary: number;
  promotionDate: string;
  currentMonth: string;
  notes?: string;
}

export interface UpdateIncrementData {
  employeeGradeId?: string;
  designationId?: string;
  incrementType?: 'Increment' | 'Decrement';
  incrementAmount?: number;
  incrementPercentage?: number;
  incrementMethod?: 'Amount' | 'Percent';
  salary?: number;
  promotionDate?: string;
  currentMonth?: string;
  notes?: string;
}

// Bulk create increments
export async function bulkCreateIncrements(data: {
  increments: CreateIncrementData[];
}): Promise<{ status: boolean; data?: Increment[]; message?: string }> {
  try {
    const res = await authFetch(`/increments/bulk`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create increments' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    revalidatePath('/hr/payroll-setup/increment');
    return result;
  } catch (error) {
    console.error('Error creating increments:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create increments' };
  }
}

// Get all increments
export async function getIncrements(params?: {
  employeeId?: string;
  month?: string;
  year?: string;
}): Promise<{ status: boolean; data?: Increment[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params?.month) queryParams.append('month', params.month);
    if (params?.year) queryParams.append('year', params.year);
    const res = await authFetch(`/increments?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch increments' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching increments:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch increments. Please check your connection.'
    };
  }
}

// Get increment by id
export async function getIncrementById(id: string): Promise<{ status: boolean; data?: Increment; message?: string }> {
  try {
    const res = await authFetch(`/increments/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch increment' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching increment:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch increment'
    };
  }
}

// Update increment
export async function updateIncrement(id: string, data: UpdateIncrementData): Promise<{ status: boolean; data?: Increment; message?: string }> {
  try {
    const res = await authFetch(`/increments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update increment' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    revalidatePath('/hr/payroll-setup/increment');
    return result;
  } catch (error) {
    console.error('Error updating increment:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update increment' };
  }
}

// Delete increment
export async function deleteIncrement(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/increments/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete increment' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    revalidatePath('/hr/payroll-setup/increment');
    return result;
  } catch (error) {
    console.error('Error deleting increment:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete increment' };
  }
}

// Get latest salary for an employee (from most recent increment or joining salary)
export async function getLatestEmployeeSalary(employeeId: string, joiningOrBaseSalary: number): Promise<number> {
  try {
    const result = await getIncrements({ employeeId });
    if (result.status && result.data && result.data.length > 0) {
      // Sort by promotion date descending to get the latest increment
      const sortedIncrements = result.data.sort((a, b) => 
        new Date(b.promotionDate).getTime() - new Date(a.promotionDate).getTime()
      );
      return sortedIncrements[0].salary;
    }
    // If no increments found, return the joining/base salary
    return joiningOrBaseSalary;
  } catch (error) {
    console.error('Error fetching latest salary:', error);
    // Fallback to joining salary on error
    return joiningOrBaseSalary;
  }
}