'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status: string;
  isRemote: boolean;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  workingHours?: number | null;
  overtimeHours?: number | null;
  lateMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  breakDuration?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    employeeId: string;
    employeeName: string;
    departmentId?: string;
    subDepartmentId?: string;
    workingHoursPolicyId?: string;
  };
}
// Get all attendances with filters
export async function getAttendances(filters?: {
  employeeId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  status?: string;
}): Promise<{ status: boolean; data?: Attendance[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.dateFrom) {
      const date = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString();
      params.append('dateFrom', date);
    }
    if (filters?.dateTo) {
      const date = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString();
      params.append('dateTo', date);
    }
    if (filters?.status) params.append('status', filters.status);
    const res = await authFetch(`/attendances?${params.toString()}`, {
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching attendances:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendances. Please check your connection.',
    };
  }
}
// Get attendance by id
export async function getAttendanceById(id: string): Promise<{ status: boolean; data?: Attendance; message?: string }> {
  try {
    const res = await authFetch(`/attendances/${id}`, {
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendance',
    };
  }
}
// Create single attendance record
export async function createAttendance(data: {
  employeeId: string;
  date: string | Date;
  checkIn?: string | Date;
  checkOut?: string | Date;
  status?: string;
  isRemote?: boolean;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}): Promise<{ status: boolean; data?: Attendance; message?: string }> {
  try {
    // Convert dates to ISO strings
    const payload: any = {
      employeeId: data.employeeId,
      date: data.date instanceof Date ? data.date.toISOString() : data.date,
    };
    if (data.checkIn) {
      payload.checkIn = data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn;
    }
    if (data.checkOut) {
      payload.checkOut = data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut;
    }
    if (data.status) payload.status = data.status;
    if (data.isRemote !== undefined) payload.isRemote = data.isRemote;
    if (data.location) payload.location = data.location;
    if (data.latitude !== undefined) payload.latitude = data.latitude;
    if (data.longitude !== undefined) payload.longitude = data.longitude;
    if (data.notes) payload.notes = data.notes;
    const res = await authFetch(`/attendances`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status) {
      revalidatePath('/hr/attendance');
      revalidatePath('/hr/attendance/manage');
      revalidatePath('/hr/attendance/view');
    }
    return result;
  } catch (error) {
    console.error('Error creating attendance:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create attendance' };
  }
}
// Create attendance records for a date range
export async function createAttendanceForDateRange(data: {
  employeeId: string;
  fromDate: string | Date;
  toDate: string | Date;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  isRemote?: boolean;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}): Promise<{ status: boolean; data?: Attendance[]; errors?: Array<{ date: string; error: string }>; message?: string }> {
  try {
    const payload: any = {
      employeeId: data.employeeId,
      fromDate: data.fromDate instanceof Date ? data.fromDate.toISOString() : data.fromDate,
      toDate: data.toDate instanceof Date ? data.toDate.toISOString() : data.toDate,
    };
    if (data.checkIn) payload.checkIn = data.checkIn;
    if (data.checkOut) payload.checkOut = data.checkOut;
    if (data.status) payload.status = data.status;
    if (data.isRemote !== undefined) payload.isRemote = data.isRemote;
    if (data.location) payload.location = data.location;
    if (data.latitude !== undefined) payload.latitude = data.latitude;
    if (data.longitude !== undefined) payload.longitude = data.longitude;
    if (data.notes) payload.notes = data.notes;
    const res = await authFetch(`/attendances/date-range`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status) {
      revalidatePath('/hr/attendance');
      revalidatePath('/hr/attendance/manage');
    }
    return result;
  } catch (error) {
    console.error('Error creating attendance records:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create attendance records' };
  }
}
// Update attendance record
export async function updateAttendance(
  id: string,
  data: {
    checkIn?: string | Date;
    checkOut?: string | Date;
    status?: string;
    isRemote?: boolean;
    location?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }
): Promise<{ status: boolean; data?: Attendance; message?: string }> {
  try {
    const payload: any = {};
    if (data.checkIn !== undefined) {
      payload.checkIn = data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn;
    }
    if (data.checkOut !== undefined) {
      payload.checkOut = data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut;
    }
    if (data.status !== undefined) payload.status = data.status;
    if (data.isRemote !== undefined) payload.isRemote = data.isRemote;
    if (data.location !== undefined) payload.location = data.location;
    if (data.latitude !== undefined) payload.latitude = data.latitude;
    if (data.longitude !== undefined) payload.longitude = data.longitude;
    if (data.notes !== undefined) payload.notes = data.notes;
    const res = await authFetch(`/attendances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status) {
      revalidatePath('/hr/attendance');
      revalidatePath('/hr/attendance/manage');
      revalidatePath('/hr/attendance/view');
    }
    return result;
  } catch (error) {
    console.error('Error updating attendance:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update attendance' };
  }
}
// Delete attendance record
export async function deleteAttendance(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/attendances/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status) {
      revalidatePath('/hr/attendance');
      revalidatePath('/hr/attendance/manage');
    }
    return result;
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete attendance' };
  }
}
// Bulk upload attendance from CSV
export async function bulkUploadAttendance(file: File): Promise<{
  status: boolean;
  data?: Attendance[];
  errors?: Array<{ row: Record<string, string>; error: string }>;
  message?: string;
}> {
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch(`/attendances/bulk-upload`, {
      method: 'POST',
      body: fd,
    });
    const json = res.data;
    if (!json.status) {
      return {
        status: false,
        message: json?.message || `Upload failed with status ${res.status}`,
      };
    }
    revalidatePath('/hr/attendance');
    revalidatePath('/hr/attendance/manage');
    return json;
  } catch (error) {
    console.error('Error uploading attendance CSV:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to upload attendance CSV',
    };
  }
}
// Get attendance progress summary
export interface AttendanceProgress {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentName?: string;
  subDepartment?: string;
  subDepartmentName?: string;
  designation?: string;
  designationName?: string;
  days: number;
  scheduleDays: number;
  offDays: number;
  present: number;
  presentOnHoliday: number;
  leaves: number;
  absents: number;
  late: number;
  halfDay: number;
  shortDays: number;
  scheduleTime: string;
  actualWorkedTime: string;
  breakTime: string;
  absentTime: string;
  overtimeBeforeTime: string;
  overtimeAfterTime: string;
  shortExcessTime: string;
}
export async function getAttendanceProgressSummary(filters?: {
  employeeId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}): Promise<{ status: boolean; data?: AttendanceProgress[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.append('employeeId', filters.employeeId);
    if (filters?.departmentId) params.append('departmentId', filters.departmentId);
    if (filters?.subDepartmentId) params.append('subDepartmentId', filters.subDepartmentId);
    if (filters?.dateFrom) {
      const date = typeof filters.dateFrom === 'string' ? filters.dateFrom : filters.dateFrom.toISOString();
      params.append('dateFrom', date);
    }
    if (filters?.dateTo) {
      const date = typeof filters.dateTo === 'string' ? filters.dateTo : filters.dateTo.toISOString();
      params.append('dateTo', date);
    }
    const res = await authFetch(`/attendances/summary?${params.toString()}`, {
    });
    if (!res.ok) {
      const errorData = res.data;;
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch attendance summary. Please check your connection.',
    };
  }
}
