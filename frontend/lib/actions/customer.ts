'use server';

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Customer {
  id: string;
  code: string;
  name: string;
  address?: string;
  contactNo?: string;
}

export async function getCustomers() {
  try {
    const response = await authFetch("/sales/customers");
    const result = response.data;
    return Array.isArray(result) ? result : (result?.data ?? []);
  } catch (error) {
    return [];
  }
}

export async function createCustomer(data: Omit<Customer, "id">) {
  try {
    const response = await authFetch("/sales/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = response.data;
    if (result?.status) {
      revalidatePath("/erp/sales/customers");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create customer" };
  }
}

export async function updateCustomer(id: string, data: Partial<Omit<Customer, "id">>) {
  try {
    const response = await authFetch(`/sales/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = response.data;
    if (result?.status) {
      revalidatePath("/erp/sales/customers");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to update customer" };
  }
}

export async function deleteCustomer(id: string) {
  try {
    const response = await authFetch(`/sales/customers/${id}`, {
      method: "DELETE",
    });
    const result = response.data;
    if (result?.status) {
      revalidatePath("/erp/sales/customers");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to delete customer" };
  }
}
