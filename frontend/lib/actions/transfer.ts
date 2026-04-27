"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export async function createTransfer(data: {
    employeeId: string;
    transferDate: string;
    newLocationId: string;
    newCityId?: string;
    newStateId?: string;
    reason?: string;
}) {
    try {
        const res = await authFetch(`/employee-transfer`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const error = res.data;
            return { status: false, message: error.message || "Failed to create transfer" };
        }
        revalidatePath("/hr/employee/list");
        revalidatePath("/hr/employee/view/[id]");
        return { status: true, message: "Employee transferred successfully" };
    } catch (error) {
        console.error("Create transfer error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}
export async function getTransferHistory(employeeId: string) {
    try {
        const res = await authFetch(`/employee-transfer/employee/${employeeId}`, {
        });
        if (!res.ok) {
            return { status: false, data: [] };
        }
        const data = res.data;
        return { status: true, data };
    } catch (error) {
        console.error("Get transfer history error:", error);
        return { status: false, data: [] };
    }
}
