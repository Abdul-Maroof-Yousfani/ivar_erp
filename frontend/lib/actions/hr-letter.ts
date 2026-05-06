'use server';
import { authFetch } from '@/lib/auth';

export interface HrLetterType {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface HrLetter {
  id: string;
  employeeId: string;
  employeeName?: string;
  letterTypeId: string;
  letterTypeName?: string;
  letterHeadContent: string;
  note?: string;
  status?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHrLetterData {
  employeeId: string;
  letterTypeId: string;
  letterHeadContent: string;
  note?: string;
}

export interface UpdateHrLetterData {
  letterTypeId?: string;
  letterHeadContent?: string;
  note?: string;
}

// Get all HR letter types
export async function getHrLetterTypes(): Promise<{ status: boolean; data?: HrLetterType[]; message?: string }> {
  try {
    const res = await authFetch(`/hr-letter-types`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch HR letter types' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching HR letter types:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch HR letter types. Please check your connection.',
    };
  }
}

// Create HR letter
export async function createHrLetter(data: CreateHrLetterData): Promise<{ status: boolean; data?: HrLetter; message?: string }> {
  try {
    const res = await authFetch(`/hr-letters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create HR letter' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating HR letter:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create HR letter' };
  }
}

// Get all HR letters
export async function getHrLetters(params?: {
  employeeId?: string;
  letterTypeId?: string;
  departmentId?: string;
  subDepartmentId?: string;
}): Promise<{ status: boolean; data?: HrLetter[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params?.letterTypeId) queryParams.append('letterTypeId', params.letterTypeId);
    if (params?.departmentId) queryParams.append('departmentId', params.departmentId);
    if (params?.subDepartmentId) queryParams.append('subDepartmentId', params.subDepartmentId);
    const res = await authFetch(`/hr-letters?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch HR letters' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching HR letters:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch HR letters. Please check your connection.',
    };
  }
}

// Get HR letter by id
export async function getHrLetterById(id: string): Promise<{ status: boolean; data?: HrLetter; message?: string }> {
  try {
    const res = await authFetch(`/hr-letters/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch HR letter' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching HR letter:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch HR letter'
    };
  }
}

// Update HR letter
export async function updateHrLetter(id: string, data: UpdateHrLetterData): Promise<{ status: boolean; data?: HrLetter; message?: string }> {
  try {
    const res = await authFetch(`/hr-letters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update HR letter' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating HR letter:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update HR letter' };
  }
}

// Delete HR letter
export async function deleteHrLetter(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/hr-letters/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete HR letter' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting HR letter:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete HR letter' };
  }
}