# Tenant and Company ERD Documentation

This document provides a visual representation of the Entity-Relationship Diagram (ERD) for the Speed Limit multi-tenant system.

## 1. Multi-Database Architecture

The system is split into a **Management Database** (Global) and multiple **Tenant Databases** (Isolated).

### Management Database (Global)
This database manages the lifecycle of tenants and their physical storage.

```mermaid
erDiagram
    TENANT {
        string id PK
        string name
        string code UK
        boolean isActive
        datetime createdAt
    }
    COMPANY {
        string id PK
        string tenantId FK
        string name
        string code UK
        string status
        string dbName UK
        string dbUrl
        string parentId FK
    }

    TENANT ||--o{ COMPANY : "owns"
    COMPANY ||--o{ COMPANY : "hierarchy (parent/child)"
```

---

### Tenant Database (Company Specific)
Each company has its own isolated database with the following core entities.

#### A. Authentication & Authorization
```mermaid
erDiagram
    USER {
        string id PK
        string email UK
        string password
        string roleId FK
        string employeeId FK
        string status
    }
    ROLE {
        string id PK
        string name UK
        boolean isSystem
    }
    PERMISSION {
        string id PK
        string name UK
        string module
        string action
    }
    ROLE_PERMISSION {
        string id PK
        string roleId FK
        string permissionId FK
    }

    USER }o--|| ROLE : "assigned"
    ROLE ||--o{ ROLE_PERMISSION : "contains"
    PERMISSION ||--o{ ROLE_PERMISSION : "defined_in"
```

#### B. HRM & Employee Management
```mermaid
erDiagram
    EMPLOYEE {
        string id PK
        string userId FK
        string departmentId FK
        string designationId FK
        string gradeId FK
        string statusId FK
        string employeeId UK
    }
    DEPARTMENT {
        string id PK
        string name UK
        string headId FK
    }
    DESIGNATION {
        string id PK
        string name UK
    }
    SUB_DEPARTMENT {
        string id PK
        string name
        string departmentId FK
    }

    EMPLOYEE |o--|| USER : "links_to"
    EMPLOYEE ||--o{ DEPARTMENT : "belongs_to"
    EMPLOYEE ||--o{ DESIGNATION : "holds"
    DEPARTMENT ||--o{ SUB_DEPARTMENT : "contains"
```

## 2. Cross-Database Relationship

The link between the two layers is **Conceptual/Dynamic**. There are no physical Foreign Keys across databases.

1.  **Management DB** -> Knows which `dbName` to connect to for a specific `Company`.
2.  **Tenant DB** -> Contains the actual `User` and `Employee` data for that company.

| From (Management) | To (Tenant Connection) | Key Link |
| :--- | :--- | :--- |
| `Company.code` | Request Context | Used in `x-tenant-id` header to route requests. |
| `Company.dbName` | Connection String | Used by `PrismaTenantService` to connect. |

## 3. Data Integrity Strategy

- **Management Layer**: Ensures that `Company.code` and `Company.dbName` are unique globally.
- **Tenant Layer**: Ensures that items like `User.email` and `Employee.employeeId` are unique within that specific company's database.
