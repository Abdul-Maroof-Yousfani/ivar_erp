'use server';
import { authFetch } from '@/lib/auth';

export interface DeductionHead {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
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

// Get deduction head by id
export async function getDeductionHeadById(id: string): Promise<{ status: boolean; data?: DeductionHead; message?: string }> {
  try {
    const res = await authFetch(`/deduction-heads/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to fetch deduction head' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error fetching deduction head:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to fetch deduction head'
    };
  }
}

// Create deduction head
export async function createDeductionHead(data: { name: string; status?: string }): Promise<{ status: boolean; data?: DeductionHead; message?: string }> {
  try {
    const res = await authFetch(`/deduction-heads`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create deduction head' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating deduction head:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create deduction head' };
  }
}

// Create deduction heads bulk
export async function createDeductionHeadsBulk(items: { name: string; status?: string }[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/deduction-heads/bulk`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to create deduction heads' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error creating deduction heads:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create deduction heads' };
  }
}

// Update deduction head
export async function updateDeductionHead(id: string, data: { name: string; status?: string }): Promise<{ status: boolean; data?: DeductionHead; message?: string }> {
  try {
    const res = await authFetch(`/deduction-heads/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to update deduction head' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error updating deduction head:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update deduction head' };
  }
}

// Delete deduction head
export async function deleteDeductionHead(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/deduction-heads/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorData = res.data || { message: 'Failed to delete deduction head' };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error('Error deleting deduction head:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete deduction head' };
  }
}

// Update deduction heads bulk
export async function updateDeductionHeads(items: {
  id: string;
  name: string;
  status?: string;
}[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      items.map(item => updateDeductionHead(item.id, item))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} deduction head(s) failed to update` };
    }
    return { status: true, message: `${results.length} deduction head(s) updated successfully` };
  } catch (error) {
    console.error('Error updating deduction heads:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update deduction heads' };
  }
}

// Delete deduction heads bulk
export async function deleteDeductionHeads(ids: string[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      ids.map(id => deleteDeductionHead(id))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} deduction head(s) failed to delete` };
    }
    return { status: true, message: `${results.length} deduction head(s) deleted successfully` };
  } catch (error) {
    console.error('Error deleting deduction heads:', error);
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete deduction heads' };
  }
}