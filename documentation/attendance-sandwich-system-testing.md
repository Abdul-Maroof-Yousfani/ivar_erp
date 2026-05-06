# Testing the Attendance Sandwich System

## Test Scenarios

### Test 1: Basic Sandwich Rule Application

**Steps:**
1. Go to http://hr.localtest.me:3001/hr/attendance/manage
2. Select an employee
3. Mark Friday (e.g., Jan 5, 2024) as **Absent**
4. Mark Monday (e.g., Jan 8, 2024) as **Absent**
5. Check the attendance records

**Expected Result:**
- Saturday (Jan 6) should be automatically marked as Absent
- Sunday (Jan 7) should be automatically marked as Absent
- Both weekend records should have note: "Sandwich rule applied - absent due to Friday and Monday absence"

### Test 2: Sandwich Rule Removal

**Steps:**
1. Start with Test 1 completed (Friday and Monday absent, weekend auto-marked)
2. Change Friday status from **Absent** to **Present**
3. Check the attendance records

**Expected Result:**
- Friday should now show as Present
- Saturday record should be deleted (if it was created by sandwich rule)
- Sunday record should be deleted (if it was created by sandwich rule)
- Monday should still show as Absent

### Test 3: Reverse Order (Monday First)

**Steps:**
1. Mark Monday (e.g., Jan 8, 2024) as **Absent** first
2. Then mark Friday (e.g., Jan 5, 2024) as **Absent**
3. Check the attendance records

**Expected Result:**
- Saturday and Sunday should be automatically marked as Absent
- Both should have the sandwich rule note

### Test 4: Manual Weekend Records Preserved

**Steps:**
1. Manually create Saturday attendance as **Present** with custom notes
2. Mark Friday as **Absent**
3. Mark Monday as **Absent**
4. Check Saturday record

**Expected Result:**
- Saturday record should be updated to Absent
- Original notes should be preserved with "| Sandwich rule applied" appended

### Test 5: Partial Absence (Only Friday)

**Steps:**
1. Mark Friday as **Absent**
2. Mark Monday as **Present**
3. Check weekend records

**Expected Result:**
- Saturday and Sunday should NOT be automatically marked as absent
- No sandwich rule should be applied

### Test 6: Leave Days Not Affected

**Steps:**
1. Mark Friday as **Leave**
2. Mark Monday as **Leave**
3. Check weekend records

**Expected Result:**
- Saturday and Sunday should NOT be affected
- Sandwich rule only applies to "absent" status, not "leave"

## API Testing

### Using Postman/cURL

**Create Absent Attendance:**
```bash
POST /api/attendances
{
  "employeeId": "employee-uuid",
  "date": "2024-01-05",
  "status": "absent"
}
```

**Update Attendance Status:**
```bash
PUT /api/attendances/{attendance-id}
{
  "status": "present"
}
```

**Check Weekend Records:**
```bash
GET /api/attendances?employeeId=employee-uuid&dateFrom=2024-01-06&dateTo=2024-01-07
```

## Database Verification

**Check Sandwich Rule Records:**
```sql
SELECT 
  id,
  employeeId,
  date,
  status,
  notes,
  createdAt
FROM attendance
WHERE notes LIKE '%Sandwich rule applied%'
ORDER BY date DESC;
```

**Check Employee's Weekly Attendance:**
```sql
SELECT 
  date,
  status,
  notes,
  DAYNAME(date) as day_name
FROM attendance
WHERE employeeId = 'employee-uuid'
  AND date BETWEEN '2024-01-05' AND '2024-01-08'
ORDER BY date;
```

## Expected Payroll Impact

After sandwich rule is applied:
1. Check payroll calculation for the employee
2. Verify that weekend absent days are included in deduction calculation
3. Confirm that 4 days of absence (Fri, Sat, Sun, Mon) are counted
4. Validate that per-day salary deduction is applied correctly

## Troubleshooting

**Issue: Weekend not marked as absent**
- Check if both Friday AND Monday are marked as "absent" (not "leave")
- Verify the dates are consecutive (Friday + 3 days = Monday)
- Check server logs for any errors

**Issue: Weekend records not removed when changing status**
- Verify the weekend records have "Sandwich rule applied" in notes
- Check if the records were manually created (these are preserved)
- Ensure the status change is from "absent" to another status

**Issue: Deductions not calculating correctly**
- Verify payroll service is reading all attendance records including weekends
- Check if the date range in payroll calculation includes the weekend dates
- Confirm the attendance status is "absent" for all four days
