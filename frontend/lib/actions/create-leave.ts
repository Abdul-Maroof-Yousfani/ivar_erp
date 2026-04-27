'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface CreateLeaveData {
  employeeId: string;
  leaveTypeId: string;
  dayType: string;
  fromDate: string;
  toDate: string;
  remarks?: string;
}

export interface LeaveEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode?: string;
  leaveType: string;
  leaveTypeName?: string;
  dayType: string;
  fromDate: string;
  toDate: string;
  remarks?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Create leave request
export async function createLeave(data: CreateLeaveData): Promise<{ status: boolean; data?: LeaveEntry; message?: string }> {
  try {
    if (!data.employeeId || !data.leaveTypeId || !data.fromDate || !data.toDate || !data.dayType) {
      return { status: false, message: 'All required fields must be filled' };
    }
    const res = await authFetch(`/leave-requests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create leave request' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      revalidatePath('/hr/leaves/requests');
      revalidatePath('/hr/leaves/create-leaves');
      return { status: true, data: result.data };
    }
    return { status: false, message: result.message || 'Failed to create leave request' };
  } catch (error) {
    console.error('Error creating leave request:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to create leave request',
    };
  }
}

// Get leave requests for an employee (for data table)
export async function getEmployeeLeaveRequests(employeeId: string): Promise<{ status: boolean; data?: LeaveEntry[]; message?: string }> {
  try {
    const res = await authFetch(`/leave-requests?employeeId=${employeeId}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch leave requests' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      return { status: true, data: result.data };
    }
    return { status: false, message: 'Invalid response format' };
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch leave requests',
    };
  }
}