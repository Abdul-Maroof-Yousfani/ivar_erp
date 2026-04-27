'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
export interface AttendanceExemption {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  department?: string | null;
  subDepartment?: string | null;
  attendanceDate: string;
  flagType: string;
  exemptionType: string;
  reason: string;
  approvalStatus: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
// Get all attendance exemptions
export async function getAttendanceExemptions(): Promise<{ status: boolean; data?: AttendanceExemption[]; message?: string }> {
  try {
    const res = await authFetch(`/attendance-exemptions`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch attendance exemptions' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const { data } = res;
    return { status: true, data: data.data || data };
  } catch (error) {
    console.error('Error fetching attendance exemptions:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendance exemptions. Please check your connection.',
    };
  }
}
// Get attendance exemption by ID
export async function getAttendanceExemptionById(id: string): Promise<{ status: boolean; data?: AttendanceExemption; message?: string }> {
  try {
    const res = await authFetch(`/attendance-exemptions/${id}`, {
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch attendance exemption' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error fetching attendance exemption:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendance exemption',
    };
  }
}
// Create attendance exemption
export async function createAttendanceExemption(data: Omit<AttendanceExemption, 'id' | 'createdAt' | 'updatedAt' | 'approvedBy' | 'approvedAt' | 'rejectionReason'>): Promise<{ status: boolean; data?: AttendanceExemption; message?: string }> {
  try {
    const res = await authFetch(`/attendance-exemptions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create attendance exemption' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      revalidatePath('/hr/attendance/exemptions-list');
      return { status: true, data: result.data };
    }
    if (result.id || result.status) {
      revalidatePath('/hr/attendance/exemptions-list');
    }
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error creating attendance exemption:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to create attendance exemption',
    };
  }
}
// Update attendance exemption
export async function updateAttendanceExemption(id: string, data: Partial<AttendanceExemption>): Promise<{ status: boolean; data?: AttendanceExemption; message?: string }> {
  try {
    const res = await authFetch(`/attendance-exemptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update attendance exemption' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      revalidatePath('/hr/attendance/exemptions-list');
      return { status: true, data: result.data };
    }
    if (result.id || result.status) {
      revalidatePath('/hr/attendance/exemptions-list');
    }
    return { status: true, data: result.data || result };
  } catch (error) {
    console.error('Error updating attendance exemption:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to update attendance exemption',
    };
  }
}
// Delete attendance exemption
export async function deleteAttendanceExemption(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/attendance-exemptions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete attendance exemption' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    revalidatePath('/hr/attendance/exemptions-list');
    return { status: true, message: 'Attendance exemption deleted successfully' };
  } catch (error) {
    console.error('Error deleting attendance exemption:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to delete attendance exemption',
    };
  }
}
