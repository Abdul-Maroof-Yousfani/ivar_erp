'use server';
import { authFetch } from '../auth';

export async function queueCustomersExport(
  search?: string,
  customerType?: string,
): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (search)       params.append('search',       search);
    if (customerType) params.append('customerType', customerType);
    const qs = params.toString();

    const res = await authFetch(`/customers/export${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
    return res.data ?? { status: false, message: 'No response from server' };
  } catch (error) {
    console.error('Queue customer export error:', error);
    return { status: false, message: 'Failed to connect to server' };
  }
}
