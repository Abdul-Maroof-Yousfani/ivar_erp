'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface KpiTemplate {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  metricType: string;
  formula?: string | null;
  unit?: string | null;
  targetValue?: number | string | null;
  weight: number | string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface KpiReview {
  id: string;
  employeeId: string;
  employee?: {
    id: string;
    employeeId: string;
    employeeName: string;
    departmentId?: string;
    department?: { id: string; name: string } | null;
  };
  kpiTemplateId: string;
  kpiTemplate?: KpiTemplate;
  period: string;
  periodType: string;
  targetValue: number | string;
  actualValue?: number | string | null;
  score?: number | string | null;
  notes?: string | null;
  reviewedById?: string | null;
  reviewedBy?: { id: string; firstName: string; lastName: string } | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getKpiTemplates(params?: {
  category?: string;
  status?: string;
}): Promise<{ status: boolean; data?: KpiTemplate[]; message?: string }> {
  try {
    const q = new URLSearchParams();
    if (params?.category) q.append('category', params.category);
    if (params?.status) q.append('status', params.status);
    const res = await authFetch(`/kpi/templates?${q.toString()}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to fetch KPI templates' };
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to fetch KPI templates' };
  }
}

export async function createKpiTemplate(data: {
  name: string;
  description?: string;
  category: string;
  metricType: string;
  formula?: string;
  unit?: string;
  targetValue?: number;
  weight?: number;
}): Promise<{ status: boolean; data?: KpiTemplate; message?: string }> {
  try {
    const res = await authFetch('/kpi/templates', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to create KPI template' };
    revalidatePath('/hr/kpi/templates');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create KPI template' };
  }
}

export async function updateKpiTemplate(
  id: string,
  data: Partial<{ name: string; description: string; category: string; metricType: string; formula: string; unit: string; targetValue: number; weight: number; status: string }>,
): Promise<{ status: boolean; data?: KpiTemplate; message?: string }> {
  try {
    const res = await authFetch(`/kpi/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to update KPI template' };
    revalidatePath('/hr/kpi/templates');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update KPI template' };
  }
}

export async function deleteKpiTemplate(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/kpi/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to delete KPI template' };
    revalidatePath('/hr/kpi/templates');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete KPI template' };
  }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function getKpiReviews(params?: {
  employeeId?: string;
  kpiTemplateId?: string;
  period?: string;
  periodType?: string;
  status?: string;
}): Promise<{ status: boolean; data?: KpiReview[]; message?: string }> {
  try {
    const q = new URLSearchParams();
    if (params?.employeeId) q.append('employeeId', params.employeeId);
    if (params?.kpiTemplateId) q.append('kpiTemplateId', params.kpiTemplateId);
    if (params?.period) q.append('period', params.period);
    if (params?.periodType) q.append('periodType', params.periodType);
    if (params?.status) q.append('status', params.status);
    const res = await authFetch(`/kpi/reviews?${q.toString()}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to fetch KPI reviews' };
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to fetch KPI reviews' };
  }
}

export async function createKpiReview(data: {
  employeeId: string;
  kpiTemplateId: string;
  period: string;
  periodType: string;
  targetValue: number;
  actualValue?: number;
  notes?: string;
}): Promise<{ status: boolean; data?: KpiReview; message?: string }> {
  try {
    const res = await authFetch('/kpi/reviews', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to create KPI review' };
    revalidatePath('/hr/kpi/reviews');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to create KPI review' };
  }
}

export async function updateKpiReview(
  id: string,
  data: Partial<{ actualValue: number; targetValue: number; notes: string; status: string }>,
): Promise<{ status: boolean; data?: KpiReview; message?: string }> {
  try {
    const res = await authFetch(`/kpi/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to update KPI review' };
    revalidatePath('/hr/kpi/reviews');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to update KPI review' };
  }
}

export async function deleteKpiReview(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/kpi/reviews/${id}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to delete KPI review' };
    revalidatePath('/hr/kpi/reviews');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to delete KPI review' };
  }
}

// ─── Auto-Compute ─────────────────────────────────────────────────────────────

export async function autoPopulateKpi(params: {
  employeeId: string;
  period: string;
  periodType: string;
}): Promise<{ status: boolean; data?: KpiReview[]; message?: string }> {
  try {
    const q = new URLSearchParams(params);
    const res = await authFetch(`/kpi/auto-populate?${q.toString()}`, { method: 'POST' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to auto-populate KPI reviews' };
    revalidatePath('/hr/kpi/reviews');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to auto-populate KPI reviews' };
  }
}

export interface KpiMetricResult {
  formula: string;
  label: string;
  actualValue: number;
  unit: string;
  meta?: Record<string, any>;
}

export interface KpiEmployeeSummary {
  employee: {
    id: string;
    employeeId: string;
    employeeName: string;
    departmentName?: string | null;
    designationName?: string | null;
  };
  period: string;
  periodType: string;
  overallScore: number | null;
  reviews: KpiReview[];
  liveMetrics: Record<string, KpiMetricResult>;
}

export async function getKpiEmployeeSummary(
  employeeId: string,
  period: string,
  periodType: string,
): Promise<{ status: boolean; data?: KpiEmployeeSummary; message?: string }> {
  try {
    const q = new URLSearchParams({ period, periodType });
    const res = await authFetch(`/kpi/employee/${employeeId}/summary?${q.toString()}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to fetch KPI summary' };
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to fetch KPI summary' };
  }
}

// ─── Org Dashboard ────────────────────────────────────────────────────────────

export interface KpiOrgDashboard {
  period: string;
  periodType: string;
  summary: {
    totalReviews: number;
    avgScore: number | null;
    byStatus: Record<string, number>;
    scoredCount: number;
  };
  scoreDistribution: Array<{ label: string; min: number; max: number; count: number }>;
  departmentBreakdown: Array<{ department: string; avgScore: number | null; reviewCount: number }>;
  categoryBreakdown: Array<{ category: string; avgScore: number; count: number }>;
  topPerformers: Array<{ employeeId: string; name: string; score: number }>;
  bottomPerformers: Array<{ employeeId: string; name: string; score: number }>;
  liveMetricAverages: Array<{ formula: string; avgValue: number; sampleSize: number }>;
}

export async function getKpiOrgDashboard(
  period: string,
  periodType: string,
): Promise<{ status: boolean; data?: KpiOrgDashboard; message?: string }> {
  try {
    const q = new URLSearchParams({ period, periodType });
    const res = await authFetch(`/kpi/dashboard?${q.toString()}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to fetch KPI dashboard' };
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to fetch KPI dashboard' };
  }
}

export async function exportKpiReviews(
  period: string,
): Promise<{ status: boolean; data?: Record<string, any>[]; message?: string }> {
  try {
    const res = await authFetch(`/kpi/export?period=${period}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to export KPI reviews' };
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to export KPI reviews' };
  }
}

// ─── Approval Workflow ────────────────────────────────────────────────────────

export async function listPendingKpiApprovals(params?: {
  period?: string;
  departmentId?: string;
}): Promise<{ status: boolean; data?: KpiReview[]; message?: string }> {
  try {
    const q = new URLSearchParams();
    if (params?.period) q.append('period', params.period);
    if (params?.departmentId) q.append('departmentId', params.departmentId);
    const res = await authFetch(`/kpi/approvals/pending?${q.toString()}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to fetch pending approvals' };
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to fetch pending approvals' };
  }
}

export async function submitKpiReview(id: string): Promise<{ status: boolean; data?: KpiReview; message?: string }> {
  try {
    const res = await authFetch(`/kpi/reviews/${id}/submit`, { method: 'POST' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to submit review' };
    revalidatePath('/hr/kpi/reviews');
    revalidatePath('/hr/kpi/approvals');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to submit review' };
  }
}

export async function approveKpiReview(
  id: string,
  notes?: string,
): Promise<{ status: boolean; data?: KpiReview; message?: string }> {
  try {
    const res = await authFetch(`/kpi/reviews/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to approve review' };
    revalidatePath('/hr/kpi/approvals');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to approve review' };
  }
}

export async function rejectKpiReview(
  id: string,
  rejectionReason: string,
): Promise<{ status: boolean; data?: KpiReview; message?: string }> {
  try {
    const res = await authFetch(`/kpi/reviews/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to reject review' };
    revalidatePath('/hr/kpi/approvals');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to reject review' };
  }
}

export async function bulkApproveKpiReviews(
  period: string,
  employeeIds?: string[],
): Promise<{ status: boolean; data?: { approved: number }; message?: string }> {
  try {
    const res = await authFetch(`/kpi/approvals/bulk-approve?period=${period}`, {
      method: 'POST',
      body: JSON.stringify({ employeeIds }),
    });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed to bulk approve' };
    revalidatePath('/hr/kpi/approvals');
    return res.data;
  } catch (error) {
    return { status: false, message: error instanceof Error ? error.message : 'Failed to bulk approve' };
  }
}
