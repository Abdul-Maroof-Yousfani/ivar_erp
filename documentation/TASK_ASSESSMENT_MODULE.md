# Task Assessment Module — Implementation Plan

## Vision

A ClickUp-style task management system embedded inside the HR platform. Employees receive task assignments with notifications, complete work, and their performance is automatically fed into the KPI engine. Managers get full visibility into who is doing what, how fast, and how well.

---

## Tech Stack (existing, no changes)

- Backend: NestJS + Prisma + PostgreSQL (multi-tenant)
- Frontend: Next.js App Router + Radix UI + TanStack Table
- Notifications: existing `NotificationsService` (in-app + email + SMS)
- KPI: existing `KpiComputeService` + `KpiReview` models
- Auth/RBAC: existing JWT + `PermissionsGuard`

---

## Module Breakdown

---

### Module 1 — Projects

The top-level container. Every task lives inside a project.

**Schema: `TaskProject`**
```
id, name, description, code (unique slug e.g. "PROJ-001"),
color, icon, status (active | archived | on_hold),
ownerId (employeeId), departmentId?,
startDate?, dueDate?,
visibility (public | private | department),
createdById, createdAt, updatedAt
```

**Relations**
- has many `TaskList`
- has many `ProjectMember` (employees with roles: owner | manager | member | viewer)
- has many `TaskLabel`

**API endpoints**
```
GET    /api/task-projects
POST   /api/task-projects
GET    /api/task-projects/:id
PUT    /api/task-projects/:id
DELETE /api/task-projects/:id
POST   /api/task-projects/:id/members
DELETE /api/task-projects/:id/members/:employeeId
```

**Permissions**
```
task.project.read
task.project.create
task.project.update
task.project.delete
task.project.manage-members
```

**Frontend pages**
```
/hr/tasks/projects              — project list (card grid view)
/hr/tasks/projects/create       — create project
/hr/tasks/projects/[id]         — project board/list view (entry point to tasks)
```

---

### Module 2 — Task Lists (Sections/Columns)

Groups tasks within a project. Like ClickUp's "Lists" or Trello columns.

**Schema: `TaskList`**
```
id, projectId, name, color, position (sort order),
status (active | archived),
createdById, createdAt, updatedAt
```

**API endpoints**
```
GET    /api/task-projects/:projectId/lists
POST   /api/task-projects/:projectId/lists
PUT    /api/task-lists/:id
DELETE /api/task-lists/:id
PUT    /api/task-lists/reorder   — bulk position update
```

---

### Module 3 — Tasks (Core)

The heart of the module. Supports multi-assignee, subtasks, priorities, due dates, time tracking, and attachments.

**Schema: `Task`**
```
id, projectId, listId,
title, description (rich text / markdown),
status (todo | in_progress | in_review | done | cancelled),
priority (none | low | medium | high | urgent),
type (task | bug | feature | improvement),
position (sort order within list),
parentTaskId?  (null = top-level, set = subtask),
startDate?, dueDate?,
estimatedHours?,
actualHours?,
completionPercentage (0-100),
isBlocked (bool),
blockedReason?,
createdById, updatedById, createdAt, updatedAt
```

**Schema: `TaskAssignee`**
```
id, taskId, employeeId,
role (primary | collaborator | reviewer),
assignedAt, assignedById
```

**Schema: `TaskLabel`**
```
id, projectId, name, color
```

**Schema: `TaskLabelAssignment`**
```
taskId, labelId
```

**Schema: `TaskAttachment`**
```
id, taskId, fileName, fileUrl, fileSize, mimeType,
uploadedById, createdAt
```

**Key behaviors**
- A task can be assigned to multiple employees simultaneously
- Subtasks are tasks with `parentTaskId` set — unlimited nesting depth (but UI shows max 2 levels like ClickUp)
- Completion of all subtasks auto-updates parent `completionPercentage`
- Changing status to `done` records `actualHours` and triggers KPI compute hook

**API endpoints**
```
GET    /api/tasks                          — list with filters (project, assignee, status, priority, due)
POST   /api/tasks                          — create task
GET    /api/tasks/:id                      — get task with subtasks + assignees + comments
PUT    /api/tasks/:id                      — update task
DELETE /api/tasks/:id
PUT    /api/tasks/:id/status               — change status (triggers notifications + KPI hook)
PUT    /api/tasks/:id/assignees            — update assignees
POST   /api/tasks/:id/attachments          — upload attachment
DELETE /api/tasks/:id/attachments/:attachId
PUT    /api/tasks/reorder                  — drag-and-drop reorder (bulk position update)
GET    /api/tasks/my-tasks                 — tasks assigned to current user
GET    /api/tasks/overdue                  — overdue tasks (for dashboard widget)
```

**Permissions**
```
task.read
task.create
task.update
task.delete
task.assign
task.manage-all   — see all tasks regardless of assignment
```

---

### Module 4 — Comments & Activity Feed

Every task has a threaded comment section and an immutable activity log.

**Schema: `TaskComment`**
```
id, taskId, authorId (userId from master DB),
content (markdown), parentCommentId? (for replies),
isEdited, editedAt?,
createdAt, updatedAt
```

**Schema: `TaskActivity`**
```
id, taskId, actorId (userId),
action (created | status_changed | assigned | unassigned |
        priority_changed | due_date_changed | commented |
        attachment_added | subtask_added | completed),
oldValue?, newValue?,
createdAt
```

Activity is written automatically by the service on every mutation — no manual logging needed.

**API endpoints**
```
GET    /api/tasks/:id/comments
POST   /api/tasks/:id/comments
PUT    /api/task-comments/:id
DELETE /api/task-comments/:id
GET    /api/tasks/:id/activity
```

---

### Module 5 — Notifications

Leverages the existing `NotificationsService`. No new infrastructure needed.

**Trigger → Notification mapping**

| Event | Who gets notified | Priority |
|---|---|---|
| Task assigned to you | Assignee | high |
| Task due in 24 hours | All assignees | high |
| Task overdue | All assignees + project manager | urgent |
| Task status changed | All assignees + creator | normal |
| Comment mentioning you (`@name`) | Mentioned user | normal |
| Subtask completed | Parent task assignees | low |
| Task blocked | All assignees + manager | high |
| Task completed | Creator + project owner | normal |

**Implementation**
- Due-date reminders: a scheduled job (Bull queue, existing `QueueModule`) runs every hour, finds tasks due within 24h, sends notifications if not already sent (`notifiedAt` field on task)
- All other notifications fire synchronously inside the service method after the DB write

---

### Module 6 — KPI Integration

This is the bridge between task completion and the KPI engine.

**New auto-formula: `task_completion_rate`**

Added to `KpiComputeService`:
```typescript
// task_completion_rate = (tasks_completed_on_time / total_tasks_assigned) * 100
// "on time" = completedAt <= dueDate
```

**New auto-formula: `task_quality_score`**

```typescript
// task_quality_score = average reviewer rating across completed tasks in period
// Requires TaskReview model (Module 7)
```

**New auto-formula: `avg_task_completion_hours`**

```typescript
// avg_task_completion_hours = avg(actualHours) for completed tasks in period
// Lower is better — score = (estimatedHours / actualHours) * 100, capped at 100
```

**New KPI templates seeded automatically**
```
- Task Completion Rate       (auto, formula: task_completion_rate,    target: 85%)
- Task Quality Score         (auto, formula: task_quality_score,       target: 80 score)
- Delivery Efficiency        (auto, formula: avg_task_completion_hours, target: 100%)
```

**Hook: on task status → done**
```
TaskService.complete() calls KpiComputeService.compute(employeeId, 'task_completion_rate', ...)
and upserts the KpiReview for the current period — same pattern as Phase 2
```

---

### Module 7 — Task Reviews (Quality Assessment)

After a task is marked done, the project manager or reviewer can rate the quality of the work. This feeds `task_quality_score` KPI.

**Schema: `TaskReview`**
```
id, taskId, reviewerId (userId),
rating (1-5),
feedback?,
createdAt
```

**API endpoints**
```
POST   /api/tasks/:id/review
GET    /api/tasks/:id/review
```

**Frontend**
- Appears as a "Rate this task" card on the task detail page after status = done
- Only visible to users with `task.review` permission

---

### Module 8 — Views (Board / List / Calendar / My Tasks)

Four views of the same data, all driven by the same API.

**Board view** (`/hr/tasks/projects/[id]?view=board`)
- Kanban columns = TaskLists
- Cards show: title, assignee avatars, priority badge, due date, subtask count
- Drag-and-drop between columns updates `listId` + `status`
- Uses `@dnd-kit/core` (lightweight, already compatible with React 19)

**List view** (`/hr/tasks/projects/[id]?view=list`)
- TanStack Table with inline editing
- Groupable by: status, assignee, priority, due date
- Bulk actions: reassign, change status, delete

**Calendar view** (`/hr/tasks/projects/[id]?view=calendar`)
- Monthly calendar showing tasks by due date
- Uses existing `date-fns` + a simple grid layout

**My Tasks view** (`/hr/tasks/my-tasks`)
- Personal task inbox — all tasks assigned to the logged-in employee
- Grouped by: Today / This Week / Overdue / No Due Date
- Quick status update inline

---

### Module 9 — Dashboard Widgets

**HR Admin Dashboard** — add to existing dashboard:
- Tasks due today (count)
- Overdue tasks (count + list)
- Task completion rate this week (% bar)
- Top 5 employees by tasks completed this month

**Employee My Dashboard** — add to Performance tab:
- My open tasks count
- My overdue tasks (red badge)
- Task completion rate this period (feeds into KPI card already there)

---

### Module 10 — Reporting & Export

**Reports available**
```
GET /api/task-reports/employee-summary?employeeId=&period=
    → tasks assigned, completed, overdue, avg completion time, quality score

GET /api/task-reports/project-summary?projectId=
    → total tasks, completion %, overdue count, member contributions

GET /api/task-reports/department-summary?departmentId=&period=
    → aggregated across all employees in department

GET /api/task-reports/export?projectId=&format=csv
    → flat CSV of all tasks with assignees, status, dates, hours
```

---

## Database Schema Summary

```
TaskProject
  └── ProjectMember (employees + roles)
  └── TaskList[]
       └── Task[]
            ├── TaskAssignee[] (multi-assignee)
            ├── Task[] (subtasks via parentTaskId)
            ├── TaskComment[]
            ├── TaskActivity[]
            ├── TaskAttachment[]
            ├── TaskLabelAssignment[]
            └── TaskReview?
TaskLabel (scoped to project)
```

---

## Implementation Phases

### Phase 1 — Foundation (Weeks 1–2)
- Prisma schema: all models above
- Backend: ProjectModule, TaskListModule, TaskModule (CRUD + assignees)
- Frontend: Project list, Project board view (basic), Task detail drawer
- Notifications: assignment + status change

### Phase 2 — Collaboration (Week 3)
- Comments + Activity feed (backend + frontend)
- Attachments (reuse existing `UploadModule`)
- Subtasks UI (nested under task detail)
- Due date reminders (Bull queue job)

### Phase 3 — KPI Integration (Week 4)
- `task_completion_rate`, `task_quality_score`, `avg_task_completion_hours` formulas in `KpiComputeService`
- `TaskReview` model + rating UI
- Seed 3 new KPI templates
- Wire completion hook → KPI upsert
- Performance tab in My Dashboard shows task KPIs

### Phase 4 — Views & Polish (Week 5)
- List view with TanStack Table + inline edit
- Calendar view
- My Tasks personal inbox
- Drag-and-drop board (dnd-kit)
- Bulk actions

### Phase 5 — Reporting (Week 6)
- All report endpoints
- Export CSV
- Dashboard widgets (admin + employee)

---

## Permissions to Add

```
task.project.read / create / update / delete / manage-members
task.read / create / update / delete / assign / manage-all
task.comment.read / create / update / delete
task.review / task.report.read
```

---

## KPI Formula Summary

| Formula | Source | Calculation |
|---|---|---|
| `task_completion_rate` | `Task` | completed on time / total assigned × 100 |
| `task_quality_score` | `TaskReview` | avg rating × 20 (converts 1–5 → 0–100) |
| `avg_task_completion_hours` | `Task` | (estimatedHours / actualHours) × 100, capped at 100 |

All three plug directly into the existing `KpiComputeService.compute()` switch statement and auto-populate via the existing `autoPopulate` endpoint — zero changes to the KPI approval/dashboard flow.
