'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/api$/, '') || '';

export interface EmployeeCsvRow {
  [key: string]: string;
}

export interface EmployeeCsvImportResponse {
  status: boolean;
  data?: {
    filename?: string;
    storedFilename?: string;
    path?: string;
    headers?: string[];
    rows?: EmployeeCsvRow[];
    url?: string;
    inserted?: number;
    total?: number;
  };
  errors?: Array<{
    row: Record<string, string>;
    error: string;
    stack?: string;
  }>;
  message?: string;
}

export async function uploadEmployeeCsv(file: File): Promise<EmployeeCsvImportResponse> {
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch(`/employees/import-csv`, {
      method: 'POST',
      body: fd,
    });
    const json = res.data;
    if (!json.status) {
      return {
        status: false,
        message: json?.message || `Upload failed with status ${res.status}`,
        errors: json.errors,
      };
    }
    const path = json.data?.path?.replace(/\\/g, '/');
    const url = path ? `${PUBLIC_BASE}/${path}` : undefined;
    revalidatePath('/hr/employee/list');
    return {
      status: true,
      data: {
        ...json.data,
        url,
      },
      message: json.message,
    };
  } catch (error) {
    console.error('Error uploading employee CSV:', error);
    return {
      status: false,
      message: error instanceof Error ? error.message : 'Failed to upload employee CSV',
    };
  }
}