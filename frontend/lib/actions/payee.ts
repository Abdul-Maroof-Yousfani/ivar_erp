"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Payee {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getPayees(type: 'director' | 'salary' | 'tax'): Promise<{ status: boolean; data: Payee[]; message?: string }> {
  try {
    const res = await authFetch(`/payees/${type}`, {});
    if (res.ok) {
      return { status: true, data: res.data };
    }
    return { status: false, data: [], message: `Failed to fetch ${type}s` };
  } catch (error) {
    console.error(`Failed to fetch ${type}s:`, error);
    return { status: false, data: [], message: `Failed to fetch ${type}s` };
  }
}

export async function createPayee(type: 'director' | 'salary' | 'tax', data: { name: string; code: string }): Promise<{ status: boolean; data?: Payee; message?: string }> {
  try {
    const res = await authFetch(`/payees/${type}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (res.ok || res.data?.id) {
      return { status: true, data: res.data, message: `${type} created successfully` };
    }
    return { status: false, message: res.data?.message || `Failed to create ${type}` };
  } catch (error) {
    console.error(`Failed to create ${type}:`, error);
    return { status: false, message: `Failed to create ${type}` };
  }
}
