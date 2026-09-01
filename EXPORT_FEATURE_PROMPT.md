# Export Feature — Replication Prompt

Use this prompt verbatim (filling in the `[PLACEHOLDERS]`) to generate a new background Excel export for any module in this project.

---

## Context

This project is a NestJS + Next.js monorepo. All exports follow the same architecture:

- **Background job** via Bull queue (no HTTP timeout, no heap OOM)
- **ExcelJS streaming writer** — writes row-by-row to disk, never accumulates the full workbook in memory
- **In-app notification** via the existing `NotificationsService` + WebSocket when the file is ready
- **Frontend** fires a `POST` (returns immediately), shows a toast, then the notification bell triggers the download

### Reference implementations (read these before writing anything)

| File | Purpose |
|---|---|
| `d:\projects\speed-limit\nestjs_backend\src\employee\employee-export.processor.ts` | **Primary reference** — streaming ExcelJS writer, cursor-paginated chunks, group header bands, notification on completion |
| `d:\projects\speed-limit\nestjs_backend\src\employee\employee-export.service.ts` | Queue job (reads tenantId/tenantDbUrl from PrismaService), stream file from disk |
| `d:\projects\speed-limit\nestjs_backend\src\employee\employee-export.controller.ts` | POST /queue, GET /status, GET /download — with try/catch on @Res() download |
| `d:\projects\speed-limit\nestjs_backend\src\employee\employee.module.ts` | How to register the new Bull queue and wire controller/service/processor |
| `d:\projects\speed-limit\nestjs_backend\src\finance\item\item-export.processor.ts` | Second reference — items export (different columns, same pattern) |
| `d:\projects\speed-limit\nestjs_backend\src\finance\item\item-export.service.ts` | Items export service |
| `d:\projects\speed-limit\nestjs_backend\src\finance\item\item-export.controller.ts` | Items export controller |
| `d:\projects\speed-limit\nestjs_backend\src\finance\item\item.module.ts` | Items module wiring |
| `d:\projects\speed-limit\frontend\lib\actions\employee.ts` | `queueEmployeesExport()` server action — reference for the frontend action |
| `d:\projects\speed-limit\frontend\app\hr\employee\list\page.tsx` | Export button + `handleExport` handler — reference for the list page |
| `d:\projects\speed-limit\frontend\components\dashboard\header-notifications.tsx` | `handleNotificationSelect` + `triggerDownload` helper — handles the notification click to download |

### Critical patterns to preserve exactly

1. **`PrismaService` tenant credentials** — always call `this.prisma.getTenantId()` and `this.prisma.getTenantDbUrl()` inside the *service* (not the controller), at queue time. Never read from `req.user`. See `employee-export.service.ts` lines 30-31.

2. **Streaming writer** — always use `new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath })` and call `row.commit()` after each row. Never use `new ExcelJS.Workbook()` + `writeBuffer()` for large datasets.

3. **Cursor pagination** — fetch in chunks of 500 using `{ skip: 1, cursor: { id: cursor } }`. Never `findMany` all rows at once.

4. **Download endpoint** — always wrap `streamExportFile` in try/catch in the controller because `@Res()` bypasses NestJS exception filters. Use `res.send(stream)` not `stream.pipe(res.raw)`.

5. **Notification action type** — use the pattern `[module]-export.ready` (e.g. `vendor-export.ready`). The frontend `handleNotificationSelect` in `header-notifications.tsx` switches on this string to trigger the download.

6. **Bull queue name** — register a new unique queue name in both the module (`BullModule.registerQueue`) and the processor decorator (`@Processor('...')`).

---

## The Prompt

```
I need to add a background Excel export feature for the [MODULE_NAME] module in this NestJS + Next.js project.

Follow EXACTLY the same architecture as the employee export:
- d:\projects\speed-limit\nestjs_backend\src\employee\employee-export.processor.ts
- d:\projects\speed-limit\nestjs_backend\src\employee\employee-export.service.ts
- d:\projects\speed-limit\nestjs_backend\src\employee\employee-export.controller.ts
- d:\projects\speed-limit\nestjs_backend\src\employee\employee.module.ts
- d:\projects\speed-limit\frontend\lib\actions\employee.ts  (queueEmployeesExport function)
- d:\projects\speed-limit\frontend\app\hr\employee\list\page.tsx  (Export button + handleExport)
- d:\projects\speed-limit\frontend\components\dashboard\header-notifications.tsx  (triggerDownload + handleNotificationSelect)

---

### Module details

**Module name:** [MODULE_NAME]
  e.g. "Vendor", "Purchase Order", "Sales Order", "Customer"

**Prisma model:** [PRISMA_MODEL_NAME]
  e.g. `Vendor`, `PurchaseOrder`

**Prisma schema file:** [PATH_TO_PRISMA_SCHEMA]
  e.g. d:\projects\speed-limit\nestjs_backend\prisma\schema\purchase\vendor.prisma

**Existing service file:** [PATH_TO_SERVICE]
  e.g. d:\projects\speed-limit\nestjs_backend\src\purchase\vendor\vendor.service.ts

**Existing module file:** [PATH_TO_MODULE]
  e.g. d:\projects\speed-limit\nestjs_backend\src\purchase\vendor\vendor.module.ts

**Existing controller file:** [PATH_TO_CONTROLLER]
  e.g. d:\projects\speed-limit\nestjs_backend\src\purchase\vendor\vendor.controller.ts

**Frontend list page:** [PATH_TO_LIST_PAGE]
  e.g. d:\projects\speed-limit\frontend\app\erp\procurement\vendors\list\page.tsx

**Frontend actions file:** [PATH_TO_ACTIONS]
  e.g. d:\projects\speed-limit\frontend\lib\actions\vendors.ts

---

### Export columns

Define the columns for the Excel sheet. For each column provide:
- Header label
- Data field (from the Prisma model or its relations)
- Column group (used for the colour-coded group header band in row 1)
- Width (characters)
- Optional: number format (e.g. '#,##0.00', 'dd-mmm-yyyy')
- Optional: alignment ('left' | 'center' | 'right')

[PASTE YOUR COLUMN LIST HERE — or describe the fields and I will derive them from the Prisma schema]

---

### Filters

List the query parameters the export should accept (same as the list endpoint):
[e.g. search, status, brandId, categoryId, dateFrom, dateTo]

---

### Prisma includes

List the relations that need to be included in the Prisma query to resolve display names:
[e.g. brand: { select: { name: true } }, category: { select: { name: true } }]

---

### Names to use

| Thing | Value |
|---|---|
| Bull queue name | `[module]-export`  e.g. `vendor-export` |
| Processor class | `[Module]ExportProcessor`  e.g. `VendorExportProcessor` |
| Service class | `[Module]ExportService` |
| Controller class | `[Module]ExportController` |
| Controller base path | `api/[plural-path]/export`  e.g. `api/vendors/export` |
| Notification actionType | `[module]-export.ready`  e.g. `vendor-export.ready` |
| Frontend action function | `queue[Module]sExport`  e.g. `queueVendorsExport` |
| Download filename | `[module]s-export-YYYY-MM-DD.xlsx`  e.g. `vendors-export-2026-05-14.xlsx` |

---

### Files to create

1. `[module]-export.processor.ts` — in the same folder as the existing service
2. `[module]-export.service.ts` — same folder
3. `[module]-export.controller.ts` — same folder

### Files to update

4. `[module].module.ts` — add BullModule.registerQueue, new controller, service, processor
5. `[PATH_TO_ACTIONS]` — append `queue[Module]sExport()` server action
6. `[PATH_TO_LIST_PAGE]` — add isExporting state, handleExport handler, Export button in header
7. `d:\projects\speed-limit\frontend\components\dashboard\header-notifications.tsx` — add `[module]-export.ready` case inside `handleNotificationSelect` using the existing `triggerDownload` helper

---

### Constraints (do not deviate)

- Use `ExcelJS.stream.xlsx.WorkbookWriter` — never `new ExcelJS.Workbook()` + `writeBuffer()`
- Call `row.commit()` after every data row
- Cursor-paginate in chunks of 500 using `{ skip: 1, cursor: { id: cursor } }`
- Read `tenantId` and `tenantDbUrl` via `this.prisma.getTenantId()` / `this.prisma.getTenantDbUrl()` in the service, not from `req.user`
- Wrap the download controller method in try/catch (because `@Res()` bypasses NestJS exception filters)
- Use `res.send(stream)` for the file response — never `stream.pipe(res.raw)`
- The frontend Export button fires a POST and shows a toast; it does NOT wait for the file
- The notification click triggers the download via raw `fetch` with `credentials: "include"` — never via `authFetch` (which calls `.json()` and breaks binary responses)
- Export files are stored in `uploads/exports/export-{jobId}.xlsx` and deleted after download
```

---

## Filled example — Vendor export

```
I need to add a background Excel export feature for the Vendor module.

Follow EXACTLY the same architecture as the employee export:
[... same reference files as above ...]

Module name: Vendor
Prisma model: Vendor
Prisma schema file: d:\projects\speed-limit\nestjs_backend\prisma\schema\purchase\vendor.prisma
Existing service file: d:\projects\speed-limit\nestjs_backend\src\purchase\vendor\vendor.service.ts
Existing module file: d:\projects\speed-limit\nestjs_backend\src\purchase\vendor\vendor.module.ts
Existing controller file: d:\projects\speed-limit\nestjs_backend\src\purchase\vendor\vendor.controller.ts
Frontend list page: d:\projects\speed-limit\frontend\app\erp\procurement\vendors\list\page.tsx
Frontend actions file: d:\projects\speed-limit\frontend\lib\actions\vendors.ts

Export columns: derive from the Prisma schema — include all scalar fields plus
  relation names for: city, state, country, category

Filters: search, status, categoryId

Bull queue name: vendor-export
Notification actionType: vendor-export.ready
Frontend action function: queueVendorsExport
Download filename: vendors-export-YYYY-MM-DD.xlsx
```

---

## Quick checklist before submitting the prompt

- [ ] Pasted the Prisma schema for the target model
- [ ] Pasted or linked the existing service file (so column data mapping can be derived)
- [ ] Specified the exact file paths for module, controller, actions, and list page
- [ ] Listed the filters the export should respect (match the list endpoint)
- [ ] Confirmed the Bull queue name is unique (not already used in the project)
