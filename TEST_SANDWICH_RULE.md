# 🧪 Sandwich Rule Testing Guide

## ✅ Query Kaam Kar Gayi!

Aapne SQL query run ki aur successfully Saturday-Sunday absent mark ho gaye! 🎉

**Results:**
- Friday (Sept 18): Absent ✅
- Saturday (Sept 19): Absent ✅ (Sandwich rule applied)
- Sunday (Sept 20): Absent ✅ (Sandwich rule applied)
- Monday (Sept 21): Absent ✅
- **Attendance Deduction: 40,000** (4 days × 10,000)

---

## 🔧 Ab Automatic Kaise Karein?

### **Step 1: Backend Restart** (IMPORTANT!)

```bash
cd nestjs_backend

# Stop current process (Ctrl+C)
# Then restart:
npm run start:dev
```

**Wait for:** `Nest application successfully started`

---

### **Step 2: Test Automatic Sandwich Rule**

Ab ek **new test** karo:

1. **Attendance page** pe jao
2. Kisi employee ko **Friday absent** mark karo
3. Phir **Monday absent** mark karo
4. **Automatically Saturday-Sunday absent** ho jane chahiye!

**Example Test:**
- Employee: EMP002
- Date: **October 2, 2026 (Friday)** → Mark as Absent
- Date: **October 5, 2026 (Monday)** → Mark as Absent
- **Expected:** October 3-4 (Sat-Sun) automatically absent ho jayenge

---

### **Step 3: Verify Automatic Rule**

```sql
-- Check October attendance
SELECT 
    e."employeeId",
    a.date,
    TO_CHAR(a.date, 'Day') as day_name,
    a.status,
    a.notes
FROM "Employee" e
INNER JOIN "Attendance" a ON a."employeeId" = e.id
WHERE e."employeeId" = 'EMP002'
  AND a.date BETWEEN '2026-10-02' AND '2026-10-05'
ORDER BY a.date;
```

**Expected Result:**
```
EMP002 | 2026-10-02 | Friday    | absent | (your note)
EMP002 | 2026-10-03 | Saturday  | absent | Sandwich rule applied ✅
EMP002 | 2026-10-04 | Sunday    | absent | Sandwich rule applied ✅
EMP002 | 2026-10-05 | Monday    | absent | (your note)
```

---

## 🐛 Agar Automatic Kaam Nahi Kara?

### **Debug Steps:**

1. **Check Backend Logs:**
```bash
# Backend terminal mein dekho koi error to nahi
```

2. **Check if Code is Running:**
```bash
cd nestjs_backend
npm run start:dev
```

3. **Test API Endpoint:**
```bash
# Use the API endpoint to apply rules manually
curl -X POST http://localhost:3000/api/attendances/apply-sandwich-rules \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom": "2026-01-01", "dateTo": "2026-12-31"}'
```

---

## 📋 Current Status

### ✅ Working:
- [x] SQL query to manually apply sandwich rules
- [x] Payroll calculation includes sandwich absences
- [x] Attendance deduction shows correct amount
- [x] Backend code has sandwich rule logic
- [x] API endpoint to bulk apply rules

### 🔄 Testing Required:
- [ ] Automatic trigger when marking Friday absent
- [ ] Automatic trigger when marking Monday absent
- [ ] Retroactive check (Friday first, then Monday)
- [ ] Reverse rule (changing absent to present)

---

## 🎯 Next Steps

1. **Backend restart karo** (most important!)
2. **New attendance mark karo** (October test)
3. **Verify automatic rule** works
4. **Agar kaam nahi kara** to API endpoint use karo

---

## 💡 Pro Tip

Agar automatic rule kaam nahi kar raha, to **monthly basis** pe API endpoint run kar sakte ho:

```bash
# End of month - apply all sandwich rules
curl -X POST http://localhost:3000/api/attendances/apply-sandwich-rules \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom": "2026-09-01", "dateTo": "2026-09-30"}'
```

Yeh **one-time fix** hai jo saare missing sandwich rules apply kar dega!

---

## 🚀 Final Solution

**Best Practice:**
1. Backend restart karo
2. Test automatic rule with new attendance
3. Agar kaam kara → Perfect! ✅
4. Agar nahi kara → Monthly API call use karo

**Aap batao kya result aaya?** 🤔
