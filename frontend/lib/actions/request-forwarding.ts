"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ApprovalLevel {
  id?: string;
  level: number;
  approverType: string;
  departmentHeadMode?: string | null;
  specificEmployeeId?: string | null;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  specificEmployee?: {
    id: string;
    employeeId: string;
    employeeName: string;
  } | null;
  department?: {
    id: string;
    name: string;
  } | null;
  subDepartment?: {
    id: string;
    name: string;
  } | null;
}

export interface RequestForwardingConfiguration {
  id: string;
  requestType: string;
  approvalFlow: string;
  status: string;
  approvalLevels: ApprovalLevel[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateApprovalLevel {
  level: number;
  approverType: string;
  departmentHeadMode?: string;
  specificEmployeeId?: string | null;
  departmentId?: string | null;
  subDepartmentId?: string | null;
}

export interface CreateRequestForwardingData {
  requestType: string;
  approvalFlow: string;
  levels?: CreateApprovalLevel[];
}

export interface UpdateRequestForwardingData {
  approvalFlow?: string;
  status?: string;
  levels?: CreateApprovalLevel[];
}

export async function getRequestForwardingConfigurations() {
  try {
    const response = await authFetch(`/request-forwarding`, {
      method: "GET",
    });
    const result = response.data;
    if (!response.ok) {
      return {
        status: false,
        message: result.message || "Failed to fetch request forwarding configurations",
      };
    }
    return result;
  } catch (error) {
    console.error("Error fetching request forwarding configurations:", error);
    return {
      status: false,
      message: "Failed to fetch request forwarding configurations",
    };
  }
}

export async function getRequestForwardingByType(requestType: string) {
  try {
    const response = await authFetch(`/request-forwarding/${requestType}`, {
      method: "GET",
    });
    const result = response.data;
    if (!response.ok) {
      return {
        status: false,
        message: result.message || `Failed to fetch request forwarding configuration for ${requestType}`,
      };
    }
    return result;
  } catch (error) {
    console.error(`Error fetching request forwarding configuration for ${requestType}:`, error);
    return {
      status: false,
      message: `Failed to fetch request forwarding configuration for ${requestType}`,
    };
  }
}

export async function createRequestForwarding(data: CreateRequestForwardingData) {
  try {
    const response = await authFetch(`/request-forwarding`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = response.data;
    if (!response.ok) {
      return {
        status: false,
        message: result.message || "Failed to create request forwarding configuration",
      };
    }
    revalidatePath("/hr/request-forwarding");
    return result;
  } catch (error) {
    console.error("Error creating request forwarding configuration:", error);
    return {
      status: false,
      message: "Failed to create request forwarding configuration",
    };
  }
}

export async function updateRequestForwarding(requestType: string, data: UpdateRequestForwardingData) {
  try {
    // Remove undefined values from the payload before sending
    // JSON.stringify already omits undefined, but we need to clean nested objects
    const cleanData = JSON.parse(JSON.stringify(data));
    const response = await authFetch(`/request-forwarding/${requestType}`, {
      method: "PUT",
      body: JSON.stringify(cleanData),
    });
    const result = response.data;
    if (!response.ok) {
      return {
        status: false,
        message: result.message || "Failed to update request forwarding configuration",
      };
    }
    revalidatePath("/hr/request-forwarding");
    return result;
  } catch (error) {
    console.error("Error updating request forwarding configuration:", error);
    return {
      status: false,
      message: "Failed to update request forwarding configuration",
    };
  }
}

export async function deleteRequestForwarding(requestType: string) {
  try {
    const response = await authFetch(`/request-forwarding/${requestType}`, {
      method: "DELETE",
    });
    const result = response.data;
    if (!response.ok) {
      return {
        status: false,
        message: result.message || "Failed to delete request forwarding configuration",
      };
    }
    revalidatePath("/hr/request-forwarding");
    return result;
  } catch (error) {
    console.error("Error deleting request forwarding configuration:", error);
    return {
      status: false,
      message: "Failed to delete request forwarding configuration",
    };
  }
}