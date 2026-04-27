# RBAC (Role-Based Access Control) - Complete Flow

## 📋 Overview
Yeh document explain karta hai ke HRM application mein RBAC kaise kaam karta hai.

---

## 🔐 Step 1: User Login & Authentication

### Backend (`nestjs_backend/src/auth/auth.service.ts`)
1. User login karta hai email/password se
2. Backend user ko database se fetch karta hai **with role and permissions**:
   ```typescript
   const user = await prisma.user.findUnique({
     where: { email },
     include: {
       role: { 
         include: { 
           permissions: { include: { permission: true } } 
         } 
       },
     },
   });
   ```
3. Backend response mein user data bhejta hai:
   ```json
   {
     "user": {
       "id": "...",
       "email": "...",
       "role": {
         "name": "aaa",
         "permissions": [
           { "permission": { "name": "advance-salary.read" } },
           { "permission": { "name": "advance-salary.create" } }
         ]
       },
       "permissions": ["advance-salary.read", "advance-salary.create"] // Flat array
     },
     "accessToken": "...",
     "refreshToken": "..."
   }
   ```
4. Cookies set hote hain: `accessToken`, `refreshToken`, `userRole`, `user`

---

## 🔄 Step 2: Frontend - User Data Fetch

### File: `frontend/components/providers/auth-provider.tsx`

1. **Initial Load:**
   - Component mount hone par `fetchUser()` call hota hai
   - Pehle cookies se user data check karta hai
   - Agar cookie mein data hai, to use set kar deta hai

2. **API Call (`/api/auth/me`):**
   - Backend se fresh user data fetch karta hai
   - User object mein ye data store hota hai:
     ```typescript
     {
       id: string,
       email: string,
       role: {
         id: string,
         name: string,
         permissions: [
           { permission: { name: "advance-salary.read" } },
           { permission: { name: "advance-salary.create" } }
         ]
       },
       permissions: ["advance-salary.read", "advance-salary.create"] // Flat array
     }
     ```

3. **Permission Helper Functions:**
   - `hasPermission(permission: string)` - Check single permission
   - `hasAnyPermission(permissions: string[])` - Check if user has ANY of the permissions
   - `hasAllPermissions(permissions: string[])` - Check if user has ALL permissions
   - `isAdmin()` - Check if user is `admin` or `super_admin`

---

## 🎯 Step 3: Sidebar Menu Filtering

### File: `frontend/components/dashboard/sidebar-menu-data.ts`

1. **Menu Items Definition:**
   - Har menu item ke paas `permissions` array hota hai
   - Example:
     ```typescript
     {
       title: "Payroll Setup",
       permissions: ["payroll.read", "advance-salary.read", ...],
       children: [
         {
           title: "Advance Salary",
           permissions: ["advance-salary.read", "advance-salary.create"],
           children: [
             { title: "Create Request", href: "/hr/payroll-setup/advance-salary/create", permissions: ["advance-salary.create"] },
             { title: "View Requests", href: "/hr/payroll-setup/advance-salary/view", permissions: ["advance-salary.read"] }
           ]
         }
       ]
     }
     ```

2. **Filtering Logic (`filterMenuByPermissions`):**
   
   **Step 3.1: Admin Check**
   - Agar user `admin` ya `super_admin` hai → **Sab menu items return karo** (no filtering)
   
   **Step 3.2: For Each Menu Item:**
   ```
   For each menu item:
     ├─ If item has children:
     │   └─ Pehle children filter karo (recursively)
     │      └─ Agar sab children filter ho gaye → Parent hide karo
     │
     ├─ If item has permissions:
     │   └─ Check: hasAnyPermission(item.permissions)
     │      ├─ Yes → Show item
     │      └─ No → Hide item
     │
     └─ If item has NO permissions:
        ├─ Dashboard/Profile Settings → Show (public)
        └─ Others → Hide (security)
   ```

3. **Example Flow:**
   - User permissions: `["advance-salary.read", "advance-salary.create", "attendance-exemption.read"]`
   - "Payroll Setup" parent check:
     - Parent permissions: `["payroll.read", "advance-salary.read", ...]`
     - User has `advance-salary.read` → Parent show hoga
   - "Advance Salary" child check:
     - Child permissions: `["advance-salary.read", "advance-salary.create"]`
     - User has both → Child show hoga
   - "Create Request" sub-child check:
     - Sub-child permissions: `["advance-salary.create"]`
     - User has it → Sub-child show hoga
   - "Payroll" child check:
     - Child permissions: `["payroll.read", "payroll.create"]`
     - User doesn't have → Child hide hoga

---

## 🛡️ Step 4: Route Protection

### File: `frontend/app/hr/layout.tsx`

1. **Route Permission Mapping:**
   - File: `frontend/lib/route-permissions.ts`
   - Har route ke liye required permissions define hain:
     ```typescript
     {
       "/hr/payroll-setup/advance-salary/create": ["advance-salary.create"],
       "/hr/payroll-setup/advance-salary/view": ["advance-salary.read"],
       "/hr/attendance/exemptions": ["attendance-exemption.read"]
     }
     ```

2. **Layout Protection Flow:**
   ```
   User visits route → HRLayout component loads
     ├─ Get current pathname (e.g., "/hr/payroll-setup/advance-salary/create")
     ├─ Get required permissions for route: ["advance-salary.create"]
     │
     ├─ If user is admin/super_admin:
     │   └─ Bypass all checks → Show page
     │
     ├─ If route requires permissions:
     │   └─ Wrap with PermissionGuard
     │      ├─ Check: hasAnyPermission(["advance-salary.create"])
     │      ├─ Yes → Show page
     │      └─ No → Show "Access Denied"
     │
     └─ If route is public (no permissions):
        └─ Show page
   ```

3. **PermissionGuard Component:**
   - File: `frontend/components/auth/permission-guard.tsx`
   - Checks user permissions
   - Agar permission nahi hai → "Access Denied" page dikhata hai

---

## 🔍 Step 5: Permission Checking Functions

### File: `frontend/components/providers/auth-provider.tsx`

### `hasAnyPermission(permissions: string[])`
```typescript
// Check if user has ANY of the required permissions
hasAnyPermission(["advance-salary.read", "payroll.read"])
// Returns true if user has at least ONE permission
```

**Logic:**
1. User permissions extract karo (from `user.role.permissions` or `user.permissions`)
2. Check karo: `permissions.some(perm => userPermissions.includes(perm))`
3. Return true/false

### `hasAllPermissions(permissions: string[])`
```typescript
// Check if user has ALL of the required permissions
hasAllPermissions(["advance-salary.read", "advance-salary.create"])
// Returns true only if user has ALL permissions
```

**Logic:**
1. User permissions extract karo
2. Check karo: `permissions.every(perm => userPermissions.includes(perm))`
3. Return true/false

### `isAdmin()`
```typescript
// Check if user is admin or super_admin
isAdmin()
// Returns true if role is "admin" or "super_admin"
```

**Logic:**
1. Get role name: `user.role.name` or `user.role`
2. Check: `roleName === "admin" || roleName === "super_admin"`
3. Return true/false

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER LOGIN                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend: Fetch User + Role + Permissions            │
│         Response: { user, role, permissions }               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│    Frontend: AuthProvider - Store User Data                  │
│    - user.role.permissions (object format)                   │
│    - user.permissions (flat array)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐        ┌──────────────────┐
│  SIDEBAR MENU    │        │  ROUTE PROTECTION │
│  FILTERING       │        │                   │
└──────────────────┘        └──────────────────┘
        │                             │
        │                             │
        ▼                             ▼
┌─────────────────────────────────────────────┐
│  For each menu item:                       │
│  1. Check isAdmin() → Bypass if admin      │
│  2. Check item.permissions                 │
│  3. Filter children recursively            │
│  4. Show only accessible items             │
└─────────────────────────────────────────────┘
        │                             │
        │                             │
        ▼                             ▼
┌─────────────────────────────────────────────┐
│  For each route:                            │
│  1. Get route permissions                   │
│  2. Check isAdmin() → Bypass if admin       │
│  3. Check hasAnyPermission()                │
│  4. Show page or "Access Denied"            │
└─────────────────────────────────────────────┘
```

---

## 🎯 Key Points

1. **Admin/Super Admin:**
   - `admin` aur `super_admin` roles ko **sab kuch access** hai
   - No permission checks for them
   - Sidebar mein sab menu items dikhte hain
   - Sab routes accessible hain

2. **Regular Users:**
   - Sirf un permissions ka access jo unke role mein hain
   - Sidebar mein sirf accessible menu items dikhte hain
   - Routes protect hain - agar permission nahi hai to "Access Denied"

3. **Permission Format:**
   - Backend se: `{ permission: { name: "advance-salary.read" } }`
   - Frontend mein: `["advance-salary.read", "advance-salary.create"]` (flat array)
   - Both formats supported

4. **Menu Filtering:**
   - Parent menu sirf tab show hota hai jab user ke paas at least ek child accessible ho
   - Children ke apne permissions hote hain (parent se inherit nahi karte)

5. **Route Protection:**
   - Har route ke liye required permissions define hain
   - Unknown routes default permission require karte hain (security)

---

## 🔧 Files Involved

1. **Backend:**
   - `nestjs_backend/src/auth/auth.service.ts` - Login & user data
   - `nestjs_backend/src/common/guards/permissions.guard.ts` - API route protection

2. **Frontend:**
   - `frontend/components/providers/auth-provider.tsx` - User state & permission helpers
   - `frontend/components/dashboard/sidebar-menu-data.ts` - Menu filtering
   - `frontend/app/hr/layout.tsx` - Route protection
   - `frontend/lib/route-permissions.ts` - Route to permission mapping
   - `frontend/components/auth/permission-guard.tsx` - Permission check component

---

## ✅ Testing Checklist

- [ ] Admin user ko sab menu items dikhne chahiye
- [ ] Admin user ko sab routes accessible hone chahiye
- [ ] Regular user ko sirf un menu items dikhne chahiye jinke permissions hain
- [ ] Regular user ko sirf un routes accessible hone chahiye jinke permissions hain
- [ ] Agar user ke paas permission nahi hai, to "Access Denied" dikhna chahiye
- [ ] Parent menu sirf tab show hona chahiye jab user ke paas at least ek child accessible ho

---

## 🐛 Debug Tips

1. **Console Logs (Development Mode):**
   - `RBAC - User data from /auth/me` - User permissions
   - `RBAC Filter Item: ...` - Menu item filtering
   - `RBAC isAdmin check` - Admin role check
   - `=== USER PERMISSIONS ===` - All user permissions
   - `=== ACCESSIBLE ROUTES ===` - Routes user can access

2. **Check User Permissions:**
   ```javascript
   // In browser console
   const user = JSON.parse(document.cookie.split('user=')[1]?.split(';')[0]);
   console.log('User Permissions:', user.permissions);
   ```

3. **Check Route Permissions:**
   ```javascript
   // In browser console
   import { getRoutePermissions } from '@/lib/route-permissions';
   getRoutePermissions('/hr/payroll-setup/advance-salary/create');
   ```

---

**End of Flow Documentation**

