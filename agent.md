# Speed Limit Project

## Overview
Speed Limit is a comprehensive Human Resource Management System (HRMS) designed for performance and scalability. It features a modern, responsive frontend and a robust backend API, handling everything from employee management to payroll processing.

## Tech Stack

### Frontend
*   **Framework**: Next.js 16 (App Router)
*   **Language**: TypeScript
*   **Runtime/Package Manager**: Bun
*   **UI Components**:
    *   **Shadcn UI** (built on Radix UI) - Accessible, reusable components.
    *   **Tailwind CSS 4** - Utility-first styling.
    *   **Lucide React** - Iconography.
*   **State & Form Management**:
    *   **React Hook Form** - Performant form validation.
    *   **Zod** - Schema validation (integrated with forms).
*   **Data Fetching**: Server Actions & Axios.
*   **Data Display**:
    *   **TanStack Table** - Powerful data tables.
    *   **Recharts** - Charts and data visualization.
*   **Utilities**:
    *   **date-fns** - Date manipulation.
    *   **Sonner** - Toast notifications.
    *   **Framer Motion** (Motion) - Animations.
    *   **jsPDF / html2canvas / xlsx** - Exporting reports.

### Backend
*   **Framework**: NestJS 11
*   **Platform**: Fastify (via `@nestjs/platform-fastify`) - High-performance web framework.
*   **Language**: TypeScript
*   **Runtime**: Bun
*   **Database**:
    *   **PostgreSQL** (via `pg` driver).
    *   **Prisma ORM** - Database access and schema management.
    *   **Redis** (via `cache-manager-redis-yet`) - Caching.
*   **Authentication & Security**:
    *   **JWT** (JSON Web Tokens) - Stateless authentication.
    *   **Bcrypt** - Password hashing.
    *   **Passport** (via `@nestjs/passport` implied) - Auth strategies.
*   **Real-time**:
    *   **Socket.io** (via `@nestjs/websockets`) - Real-time events.
*   **Documentation**:
    *   **Swagger** (via `@nestjs/swagger`) - API documentation.
*   **File Handling**:
    *   **Multer** (via `@fastify/multipart`) - File uploads.
    *   **Sharp** - Image processing.
    *   **csv-parse / xlsx** - Data import/export.

## Project Structure

```
speed-limit/
├── frontend/             # Next.js 16 Application
│   ├── app/              # App Router pages & layouts
│   ├── components/       # Reusable UI components (Shadcn, Custom)
│   ├── lib/              # Utilities, server actions, types
│   ├── public/           # Static assets
│   └── ...
├── nestjs_backend/       # NestJS 11 API Server
│   ├── src/
│   │   ├── [module]/     # Feature modules (e.g., employee, payroll)
│   │   │   ├── dto/      # Data Transfer Objects
│   │   │   ├── entities/ # Database entities
│   │   │   ├── *.controller.ts
│   │   │   ├── *.service.ts
│   │   │   └── *.module.ts
│   │   ├── common/       # Guards, decorators, filters
│   │   ├── prisma/       # Database connection service
│   │   └── main.ts       # Application entry point
│   ├── prisma/           # Prisma schema & migrations
│   └── ...
└── documentation/        # Project documentation files
```

## Key Features
*   **Role-Based Access Control (RBAC)**: Granular permission management for Admins, HR, and Employees.
*   **Employee Management**: Complete lifecycle from onboarding to exit.
*   **Payroll Processing**: Automated salary generation, tax calculations, and payslip distribution.
*   **Attendance & Leaves**: Real-time tracking, shift management, and leave workflows.
*   **Performance Focused**: Built on Bun and Fastify for maximum speed.

## Development Notes

*   **Runtime**: This project strictly uses **Bun** as the package manager and runtime.
*   **Priorities**: Performance is the primary goal, followed by security.

### Frontend Guidelines
*   **Styling**: Use Shadcn UI components directly.
*   **Animations**: Prefer `motion/react` over `framer-motion` imports.
*   **Forms**: Implement strict validation using Zod and React Hook Form.
*   **API Calls**: Utilize Server Actions for secure and performant data fetching.
*   **Rendering**: Maximize Server-Side Rendering (SSR). Split components logically (e.g., `@/components/hr/file.tsx` instead of flat structures).
*   **Layout**: Ensure responsiveness; use `max-w-4xl` containers for form pages.
*   **Tables**: Use the custom `@data-table` component for consistent listing views.

### Backend Guidelines
*   **Logging**: Implement user activity logs for every significant API action.
*   **Efficiency**: Fetch only required fields from the database (avoid `select *`).
*   **Schema**: Use UUIDs for primary keys.
*   **File Uploads**: Use the dedicated `/upload` API endpoint.
