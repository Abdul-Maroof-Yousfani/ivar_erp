'use server';
import { authFetch } from '@/lib/auth';

export interface Institute {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Get all institutes
export async function getInstitutes(): Promise<{ status: boolean; data?: Institute[]; message?: string }> {
  try {
    const res = await authFetch(`/institutes`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch institutes' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching institutes:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch institutes. Please check your connection.'
    };
  }
}

// Get institute by id
export async function getInstituteById(id: string): Promise<{ status: boolean; data?: Institute; message?: string }> {
  try {
    const res = await authFetch(`/institutes/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch institute' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching institute:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch institute'
    };
  }
}

// Create institute
export async function createInstitute(data: { name: string; status?: string }): Promise<{ status: boolean; data?: Institute; message?: string }> {
  try {
    const res = await authFetch(`/institutes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create institute' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating institute:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create institute' };
  }
}

// Create institutes bulk
export async function createInstitutesBulk(items: { name: string; status?: string }[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/institutes/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create institutes' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating institutes:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create institutes' };
  }
}

// Update institute
export async function updateInstitute(id: string, data: { name: string; status?: string }): Promise<{ status: boolean; data?: Institute; message?: string }> {
  try {
    const res = await authFetch(`/institutes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update institute' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating institute:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update institute' };
  }
}

// Delete institute
export async function deleteInstitute(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/institutes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete institute' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting institute:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete institute' };
  }
}

// Update institutes bulk
export async function updateInstitutes(items: {
  id: string;
  name: string;
  status?: string;
}[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      items.map(item => updateInstitute(item.id, item))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} institute(s) failed to update` };
    }
    return { status: true, message: `${results.length} institute(s) updated successfully` };
  } catch (error) {
    console.error('Error updating institutes:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update institutes' };
  }
}

// Delete institutes bulk
export async function deleteInstitutes(ids: string[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      ids.map(id => deleteInstitute(id))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} institute(s) failed to delete` };
    }
    return { status: true, message: `${results.length} institute(s) deleted successfully` };
  } catch (error) {
    console.error('Error deleting institutes:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete institutes' };
  }
}

// Seed institutes
export async function seedInstitutes(): Promise<{ status: boolean; message?: string; data?: { total: number; created: number; skipped: number } }> {
  try {
    const res = await authFetch(`/institutes/seed`, {
      method: 'POST',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to seed institutes' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error seeding institutes:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to seed institutes' };
  }
}