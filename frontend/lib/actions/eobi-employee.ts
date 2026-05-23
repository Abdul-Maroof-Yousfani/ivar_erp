'use server';

import { authFetch } from '@/lib/auth';

export interface EOBIEmployee {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    subDepartment: string;
    designation: string;
    employeeContribution: number;
    employerContribution: number;
    totalEOBIBalance: number;
    lastContributionMonth: string;
    totalMonths: number;
}

// Get all EOBI employees with their balances
export async function getEOBIEmployees(): Promise<{ status: boolean; data?: EOBIEmployee[]; message?: string }> {
    try {
        const response = await authFetch(`/eobi/employees`, {
            method: 'GET',
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || `HTTP error! status: ${response.status}`
            };
        }

        return result;
    } catch (error) {
        console.error('Error fetching EOBI employees:', error);
        return {
            status: false,
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}
