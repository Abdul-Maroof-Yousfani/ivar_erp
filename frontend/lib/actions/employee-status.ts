'use server';
import { authFetch } from '@/lib/auth';

export interface EmployeeStatus {
  id: string;
  status: string;
  statusType: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Get all employee statuses
export async function getEmployeeStatuses(): Promise<{ status: boolean; data?: EmployeeStatus[]; message?: string }> {
  try {
    const res = await authFetch(`/employee-statuses`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch employee statuses' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching employee statuses:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch employee statuses. Please check your connection.',
    };
  }
}

// Get employee status by id
export async function getEmployeeStatusById(id: string): Promise<{ status: boolean; data?: EmployeeStatus; message?: string }> {
  try {
    const res = await authFetch(`/employee-statuses/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch employee status' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching employee status:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch employee status',
    };
  }
}

// Create employee status
export async function createEmployeeStatus(data: { status: string; statusType?: string }): Promise<{ status: boolean; data?: EmployeeStatus; message?: string }> {
  try {
    const res = await authFetch(`/employee-statuses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create employee status' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating employee status:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create employee status' };
  }
}

// Create employee statuses bulk
export async function createEmployeeStatusesBulk(items: { status: string; statusType?: string }[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/employee-statuses/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create employee statuses' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating employee statuses:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create employee statuses' };
  }
}

// Update employee status
export async function updateEmployeeStatus(id: string, data: { status: string; statusType?: string }): Promise<{ status: boolean; data?: EmployeeStatus; message?: string }> {
  try {
    const res = await authFetch(`/employee-statuses/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update employee status' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating employee status:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update employee status' };
  }
}

// Delete employee status
export async function deleteEmployeeStatus(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/employee-statuses/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete employee status' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting employee status:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete employee status' };
  }
}

// Update employee statuses bulk
export async function updateEmployeeStatuses(items: {
  id: string;
  status: string;
  statusType?: string;
}[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      items.map(item => updateEmployeeStatus(item.id, item))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} employee status(es) failed to update` };
    }
    return { status: true, message: `${results.length} employee status(es) updated successfully` };
  } catch (error) {
    console.error('Error updating employee statuses:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update employee statuses' };
  }
}

// Delete employee statuses bulk
export async function deleteEmployeeStatuses(ids: string[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      ids.map(id => deleteEmployeeStatus(id))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} employee status(es) failed to delete` };
    }
    return { status: true, message: `${results.length} employee status(es) deleted successfully` };
  } catch (error) {
    console.error('Error deleting employee statuses:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete employee statuses' };
  }
}