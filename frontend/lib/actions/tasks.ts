'use server';
import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskProject {
  id: string;
  name: string;
  description?: string | null;
  code: string;
  color?: string | null;
  icon?: string | null;
  status: string;
  ownerId: string;
  departmentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  visibility: string;
  members?: ProjectMember[];
  lists?: TaskList[];
  labels?: TaskLabel[];
  _count?: { lists: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  employeeId: string;
  role: string;
  createdAt: string;
}

export interface TaskList {
  id: string;
  projectId: string;
  name: string;
  color?: string | null;
  position: number;
  status: string;
  tasks?: Task[];
  _count?: { tasks: number };
}

export interface TaskLabel {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface TaskAssignee {
  id: string;
  taskId: string;
  employeeId: string;
  role: string;
}

export interface Task {
  id: string;
  projectId: string;
  listId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  type: string;
  position: number;
  parentTaskId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  completionPercentage: number;
  isBlocked: boolean;
  blockedReason?: string | null;
  completedAt?: string | null;
  assignees?: TaskAssignee[];
  subtasks?: Task[];
  _count?: { subtasks: number; comments: number; attachments: number };
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  parentCommentId?: string | null;
  isEdited: boolean;
  editedAt?: string | null;
  replies?: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjects(params?: { status?: string; ownerId?: string }) {
  try {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.ownerId) q.append('ownerId', params.ownerId);
    const res = await authFetch(`/task-projects?${q}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskProject[] };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function getProject(id: string) {
  try {
    const res = await authFetch(`/task-projects/${id}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskProject };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function createProject(data: Partial<TaskProject>) {
  try {
    const res = await authFetch('/task-projects', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    revalidatePath('/hr/tasks/projects');
    return res.data as { status: boolean; data: TaskProject; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function updateProject(id: string, data: Partial<TaskProject>) {
  try {
    const res = await authFetch(`/task-projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    revalidatePath('/hr/tasks/projects');
    return res.data as { status: boolean; data: TaskProject; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function deleteProject(id: string) {
  try {
    const res = await authFetch(`/task-projects/${id}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    revalidatePath('/hr/tasks/projects');
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function addProjectMember(projectId: string, employeeId: string, role = 'member') {
  try {
    const res = await authFetch(`/task-projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ employeeId, role }) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function removeProjectMember(projectId: string, employeeId: string) {
  try {
    const res = await authFetch(`/task-projects/${projectId}/members/${employeeId}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

// ─── Task Lists ───────────────────────────────────────────────────────────────

export async function getTaskLists(projectId: string) {
  try {
    const res = await authFetch(`/task-projects/${projectId}/lists`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskList[] };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function createTaskList(projectId: string, data: { name: string; color?: string }) {
  try {
    const res = await authFetch(`/task-projects/${projectId}/lists`, { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskList; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function updateTaskList(id: string, data: { name?: string; color?: string; status?: string }) {
  try {
    const res = await authFetch(`/task-lists/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskList; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function deleteTaskList(id: string) {
  try {
    const res = await authFetch(`/task-lists/${id}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function reorderTaskLists(ids: string[]) {
  try {
    const res = await authFetch('/task-lists/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(params?: {
  projectId?: string; listId?: string; assigneeId?: string;
  status?: string; priority?: string; dueBefore?: string; parentTaskId?: string;
}) {
  try {
    const q = new URLSearchParams();
    if (params?.projectId) q.append('projectId', params.projectId);
    if (params?.listId) q.append('listId', params.listId);
    if (params?.assigneeId) q.append('assigneeId', params.assigneeId);
    if (params?.status) q.append('status', params.status);
    if (params?.priority) q.append('priority', params.priority);
    if (params?.dueBefore) q.append('dueBefore', params.dueBefore);
    if (params?.parentTaskId !== undefined) q.append('parentTaskId', params.parentTaskId);
    const res = await authFetch(`/tasks?${q}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: Task[] };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function getTask(id: string) {
  try {
    const res = await authFetch(`/tasks/${id}`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: Task };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function createTask(data: {
  projectId: string; listId: string; title: string; description?: string;
  priority?: string; type?: string; dueDate?: string; estimatedHours?: number;
  assigneeIds?: string[]; parentTaskId?: string;
}) {
  try {
    const res = await authFetch('/tasks', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: Task; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function updateTask(id: string, data: Partial<Task>) {
  try {
    const res = await authFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: Task; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function changeTaskStatus(id: string, status: string, actualHours?: number) {
  try {
    const res = await authFetch(`/tasks/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, actualHours }) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: Task; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function deleteTask(id: string) {
  try {
    const res = await authFetch(`/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function reorderTasks(ids: string[], listId?: string) {
  try {
    const res = await authFetch('/tasks/reorder', { method: 'PUT', body: JSON.stringify({ ids, listId }) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function getMyTasks() {
  try {
    const res = await authFetch('/tasks/my-tasks', {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: { overdue: Task[]; today: Task[]; thisWeek: Task[]; noDueDate: Task[] } };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function bulkTaskAction(data: {
  taskIds: string[]; action: string; status?: string; priority?: string; assigneeIds?: string[];
}) {
  try {
    const res = await authFetch('/tasks/bulk', { method: 'POST', body: JSON.stringify(data) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(taskId: string) {
  try {
    const res = await authFetch(`/tasks/${taskId}/comments`, {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskComment[] };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function createComment(taskId: string, content: string, parentCommentId?: string) {
  try {
    const res = await authFetch(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content, parentCommentId }) });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: TaskComment; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const res = await authFetch(`/tasks/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; message: string };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

// ─── Reports / Widgets ────────────────────────────────────────────────────────

export async function getTaskAdminWidgets() {
  try {
    const res = await authFetch('/task-reports/widgets/admin', {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: any };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function getTaskEmployeeWidgets() {
  try {
    const res = await authFetch('/task-reports/widgets/employee', {});
    if (!res.ok) return { status: false, message: res.data?.message || 'Failed' };
    return res.data as { status: boolean; data: any };
  } catch (e) {
    return { status: false, message: e instanceof Error ? e.message : 'Failed' };
  }
}
