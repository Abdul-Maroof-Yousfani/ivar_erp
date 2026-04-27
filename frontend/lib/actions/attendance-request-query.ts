'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface AttendanceRequestQuery {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  department?: string | null;
  subDepartment?: string | null;
  attendanceDate: string;
  clockInTimeRequest?: string | null;
  clockOutTimeRequest?: string | null;
  breakIn?: string | null;
  breakOut?: string | null;
  query: string;
  approvalStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

// Get all attendance request queries
export async function getAllAttendanceRequestQueries(): Promise<{ status: boolean; data?: AttendanceRequestQuery[]; message?: string }> {
  try {
    const res = await authFetch(`/attendance-request-queries`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch attendance request queries' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error fetching attendance request queries:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendance request queries. Please check your connection.',
    };
  }
}

// Get attendance request query by ID
export async function getAttendanceRequestQueryById(id: string): Promise<{ status: boolean; data?: AttendanceRequestQuery; message?: string }> {
  try {
    const res = await authFetch(`/attendance-request-queries/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch attendance request query' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error fetching attendance request query:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendance request query',
    };
  }
}

// Create attendance request query
export async function createAttendanceRequestQuery(data: Omit<AttendanceRequestQuery, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ status: boolean; data?: AttendanceRequestQuery; message?: string }> {
  try {
    const res = await authFetch(`/attendance-request-queries`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create attendance request query' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      revalidatePath('/hr/attendance/request-list');
      return { status: true, data: result.data };
    }
    if (result.id || result.status) {
      revalidatePath('/hr/attendance/request-list');
    }
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error creating attendance request query:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to create attendance request query',
    };
  }
}

// Update attendance request query
export async function updateAttendanceRequestQuery(id: string, data: Partial<AttendanceRequestQuery>): Promise<{ status: boolean; data?: AttendanceRequestQuery; message?: string }> {
  try {
    const res = await authFetch(`/attendance-request-queries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update attendance request query' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      revalidatePath('/hr/attendance/request-list');
      return { status: true, data: result.data };
    }
    if (result.id || result.status) {
      revalidatePath('/hr/attendance/request-list');
    }
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error updating attendance request query:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to update attendance request query',
    };
  }
}

// Delete attendance request query
export async function deleteAttendanceRequestQuery(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/attendance-request-queries/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete attendance request query' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    revalidatePath('/hr/attendance/request-list');
    return { status: true, message: 'Attendance request query deleted successfully' };
  } catch (error) {
    console.error('Error deleting attendance request query:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to delete attendance request query',
    };
  }
}