"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Country {
  id: string;
  name: string;
  nicename?: string;
  iso?: string;
  iso3?: string;
  phoneCode?: number;
  numcode?: number;
  code?: string;
  cities?: City[];
  createdAt: string;
  updatedAt: string;
}

export interface State {
  id: string;
  name: string;
  countryId: string;
  country?: Country;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface City {
  id: string;
  name: string;
  countryId: string;
  stateId: string;
  country?: Country;
  state?: State;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Country Actions
export async function getCountries(): Promise<{
  status: boolean;
  data?: Country[];
  message?: string;
}> {
  try {
    const res = await authFetch(`/countries`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;
  } catch (error) {
    console.error("Failed to fetch countries:", error);
    return {
      status: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch countries. Please check your connection.",
    };
  }
}

export async function createCountry(
  formData: FormData
): Promise<{ status: boolean; message: string; data?: Country }> {
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/countries`, {
      method: "POST",
      body: JSON.stringify({ name, code }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/country");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create country" };
  }
}

export async function createCountries(
  items: { name: string; code?: string }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "At least one country is required" };
  }
  try {
    const res = await authFetch(`/countries/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/country");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create countries" };
  }
}

export async function updateCountry(
  id: string,
  formData: FormData
): Promise<{ status: boolean; message: string }> {
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/countries/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name, code }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/country");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update country" };
  }
}

export async function updateCountries(
  items: { id: string; name: string; code?: string }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }
  try {
    const res = await authFetch(`/countries/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/country");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update countries" };
  }
}

export async function deleteCountry(
  id: string
): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/countries/${id}`, {
      method: "DELETE",
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/country");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete country" };
  }
}

export async function deleteCountries(
  ids: string[]
): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/countries/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/country");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete countries" };
  }
}

// City Actions
export async function getCities(): Promise<{
  status: boolean;
  data?: City[];
  message?: string;
}> {
  try {
    const res = await authFetch(`/cities`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;
  } catch (error) {
    console.error("Failed to fetch cities:", error);
    return {
      status: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch cities. Please check your connection.",
    };
  }
}

export async function getCitiesByCountry(
  countryId: string
): Promise<{ status: boolean; data: City[] }> {
  try {
    const res = await authFetch(`/cities/country/${countryId}`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;
  } catch (error) {
    console.error("Failed to fetch cities:", error);
    return { status: false, data: [] };
  }
}

// State Actions
export async function getStates(): Promise<{
  status: boolean;
  data?: State[];
  message?: string;
}> {
  try {
    const res = await authFetch(`/states`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;

  } catch (error) {
    console.error("Failed to fetch states:", error);
    return {
      status: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch states. Please check your connection.",
    };
  }
}

export async function getStatesByCountry(
  countryId: string
): Promise<{ status: boolean; data?: State[]; message?: string }> {
  try {
    const res = await authFetch(`/states/country/${countryId}`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;
  } catch (error) {
    console.error("Failed to fetch states:", error);
    return {
      status: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch states. Please check your connection.",
    };
  }
}

export async function getCitiesByState(
  stateId: string
): Promise<{ status: boolean; data?: City[]; message?: string }> {
  try {
    const res = await authFetch(`/cities/state/${stateId}`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;

  } catch (error) {
    console.error("Failed to fetch cities:", error);
    return {
      status: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch cities. Please check your connection.",
    };
  }
}

// State CRUD Actions
export async function getStateById(
  id: string
): Promise<{ status: boolean; data?: State; message?: string }> {
  try {
    const res = await authFetch(`/states/${id}`, {
      cache: "no-store",
    });
    const { data } = res;
    return data;
  } catch (error) {
    console.error("Failed to fetch state:", error);
    return {
      status: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch state. Please check your connection.",
    };
  }
}

export async function createState(data: {
  name: string;
  countryId: string;
  status?: string;
}): Promise<{ status: boolean; data?: State; message?: string }> {
  try {
    const res = await authFetch(`/states`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/state");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create state" };
  }
}

export async function createStates(
  items: { name: string; countryId: string; status?: string }[]
): Promise<{ status: boolean; message?: string }> {
  if (!items.length) {
    return { status: false, message: "At least one state is required" };
  }
  try {
    const res = await authFetch(`/states/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/state");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create states" };
  }
}

export async function updateState(
  id: string,
  data: { name: string; countryId?: string; status?: string }
): Promise<{ status: boolean; data?: State; message?: string }> {
  try {
    const res = await authFetch(`/states/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...data, id }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/state");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update state" };
  }
}

export async function updateStates(
  items: { id: string; name: string; countryId?: string; status?: string }[]
): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/states/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/state");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update states" };
  }
}

export async function deleteState(
  id: string
): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/states/${id}`, {
      method: "DELETE",
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/state");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete state" };
  }
}

export async function deleteStates(
  ids: string[]
): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/states/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/state");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete states" };
  }
}

export async function createCity(
  formData: FormData
): Promise<{ status: boolean; message: string; data?: City }> {
  const name = formData.get("name") as string;
  const countryId = formData.get("countryId") as string;
  const stateId = formData.get("stateId") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  if (!countryId) {
    return { status: false, message: "Country is required" };
  }
  if (!stateId) {
    return { status: false, message: "State is required" };
  }
  try {
    const res = await authFetch(`/cities`, {
      method: "POST",
      body: JSON.stringify({ name, countryId, stateId }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/city");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create city" };
  }
}

export async function createCities(
  items: { name: string; countryId: string; stateId: string }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "At least one city is required" };
  }
  try {
    const res = await authFetch(`/cities/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/city");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create cities" };
  }
}

export async function updateCity(
  id: string,
  formData: FormData
): Promise<{ status: boolean; message: string }> {
  const name = formData.get("name") as string;
  const countryId = formData.get("countryId") as string;
  const stateId = formData.get("stateId") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  if (!stateId) {
    return { status: false, message: "State is required" };
  }
  try {
    const res = await authFetch(`/cities/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        id,
        name,
        countryId: countryId || undefined,
        stateId,
      }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/city");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update city" };
  }
}

export async function updateCities(
  items: { id: string; name: string; countryId: string; stateId: string }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }
  try {
    const res = await authFetch(`/cities/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/city");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update cities" };
  }
}

export async function deleteCity(
  id: string
): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/cities/${id}`, {
      method: "DELETE",
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/city");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete city" };
  }
}

export async function deleteCities(
  ids: string[]
): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/cities/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const { data } = res;
    if (data.status) revalidatePath("/master/city");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete cities" };
  }
}
