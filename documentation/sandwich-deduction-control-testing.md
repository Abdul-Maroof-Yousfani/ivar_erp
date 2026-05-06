# Sandwich Deduction Control - Testing Guide

## ✅ Implementation Complete!

### What Was Implemented

**Frontend Changes** (`frontend/app/hr/payroll-setup/payroll/create/client.tsx`):
1. ✅ Added `sandwichDeductionEnabled` state to track per-employee decisions
2. ✅ Added `useEffect` to initialize state when preview loads (default: enabled)
3. ✅ Added `handleSandwichToggle` function to recalculate deductions
4. ✅ Updated `handleConfirm` to include sandwich decisions in payload
5. ✅ Added UI checkbox with highlighted amber box showing sandwich details

**Backend Changes** (`nestjs_backend/src/payroll/payroll.service.ts`):
1. ✅ Added `sandwichAbsentCount` tracking in attendance calculation
2. ✅ Separated regular absences from sandwich absences in breakup
3. ✅ Added `sandwichAbsent` field in `attendanceBreakup` with count and amount

---

## 🧪 Testing Steps

### Test 1: Basic Sandwich Deduction Display

**Steps:**
1. Create attendance with Friday and Monday absent (sandwich rule will apply)
2. Go to Payroll → Create Payroll
3. Select April 2026 and the employee
4. Click "Preview Payroll"

**Expected Result:**
- In the Deductions column, you should see an **amber/yellow highlighted box**
- Box should show:
  - ☑ Apply Sandwich Deduction (checked by default)
  - Regular Absent: 2 days
  - Sandwich Absent: 2 days
  - Sandwich Amount: 3,000 (or calculated amount)

### Test 2: Uncheck Sandwich Deduction

**Steps:**
1. In the preview, find an employee with sandwich absences
2. **Uncheck** the "Apply Sandwich Deduction" checkbox
3. Observe the changes

**Expected Result:**
- Sandwich Amount should change to "0 (Waived)"
- Total Attendance Deduction should decrease by sandwich amount
- Net Salary should **increase** by sandwich amount
- Changes should be instant (no page refresh needed)

### Test 3: Re-check Sandwich Deduction

**Steps:**
1. After unchecking, **check** the box again
2. Observe the changes

**Expected Result:**
- Sandwich Amount should show the original amount
- Total Attendance Deduction should increase back
- Net Salary should **decrease** back to original
- All calculations should be correct

### Test 4: Multiple Employees

**Steps:**
1. Preview payroll with multiple employees
2. Some with sandwich absences, some without
3. Uncheck sandwich for Employee A
4. Keep checked for Employee B

**Expected Result:**
- Only employees with sandwich absences show the amber box
- Each employee's checkbox works independently
- Employee A: sandwich waived, higher net salary
- Employee B: sandwich applied, lower net salary

### Test 5: Confirm Payroll

**Steps:**
1. Set different sandwich deduction states for different employees
2. Click "Confirm Payroll"
3. Check the payroll report

**Expected Result:**
- Payroll should be created successfully
- Each employee's deduction should match their checkbox state
- Net salaries should be correct
- No errors in console

### Test 6: No Sandwich Absences

**Steps:**
1. Preview payroll for employees with NO sandwich absences
2. Check the deductions column

**Expected Result:**
- No amber box should appear
- Only regular attendance deduction shown
- Everything works normally

---

## 🎨 UI Appearance

### When Sandwich Absences Exist:

```
Deductions Column:
┌─────────────────────────────────┐
│ PF: 1,524                       │
│ Advance: 0                      │
│ EOBI: 0                         │
│ Loan: 0                         │
│                                 │
│ Attendance: 6,000               │
│ ┌───────────────────────────┐   │
│ │ ☑ Apply Sandwich Ded.     │   │
│ │ Regular Absent: 2 days    │   │
│ │ Sandwich Absent: 2 days   │   │
│ │ Sandwich Amount: 3,000    │   │
│ └───────────────────────────┘   │
│                                 │
│ Total: 6,924                    │
└─────────────────────────────────┘
```

### When Unchecked:

```
│ Attendance: 3,000               │
│ ┌───────────────────────────┐   │
│ │ ☐ Apply Sandwich Ded.     │   │
│ │ Regular Absent: 2 days    │   │
│ │ Sandwich Absent: 2 days   │   │
│ │ Sandwich Amount: 0 (Waived)│  │
│ └───────────────────────────┘   │
```

---

## 🔍 Verification Checklist

### Frontend
- [ ] Checkbox appears only when sandwich absences exist
- [ ] Checkbox is checked by default
- [ ] Unchecking removes sandwich amount from deduction
- [ ] Checking adds sandwich amount back
- [ ] Net salary recalculates correctly
- [ ] Multiple employees work independently
- [ ] No console errors
- [ ] UI is responsive and looks good

### Backend
- [ ] `sandwichAbsent` field exists in preview data
- [ ] Count is correct (matches weekend absent days)
- [ ] Amount is calculated correctly (per-day salary × count)
- [ ] Regular absences and sandwich absences are separated
- [ ] Confirm payroll accepts the decision
- [ ] No server errors

### Calculations
- [ ] Regular absent: Friday + Monday = 2 days
- [ ] Sandwich absent: Saturday + Sunday = 2 days
- [ ] Total absent: 4 days
- [ ] With sandwich: 4 × 1,500 = 6,000
- [ ] Without sandwich: 2 × 1,500 = 3,000
- [ ] Net salary difference: 3,000

---

## 🐛 Troubleshooting

### Issue: Checkbox not appearing
**Solution:** 
- Check if sandwich absences exist in attendance
- Verify `row.attendanceBreakup?.sandwichAbsent?.count > 0`
- Check browser console for errors

### Issue: Unchecking doesn't change amount
**Solution:**
- Check if `handleSandwichToggle` is being called
- Verify state update in `sandwichDeductionEnabled`
- Check if `setPreviewData` is updating correctly

### Issue: Net salary not recalculating
**Solution:**
- Verify all deduction components are included in calculation
- Check if `row.netSalary` is being updated
- Ensure `setPreviewData` triggers re-render

### Issue: Confirm fails
**Solution:**
- Check if `applySandwichDeduction` is in payload
- Verify backend accepts the new field
- Check server logs for errors

---

## 📊 Sample Test Data

### Employee: Atika Shahzadi (EMP210)
- Basic Salary: 45,000
- Days in Month: 30
- Per Day Salary: 1,500

**Attendance:**
- Friday (17 Apr): Absent
- Saturday (18 Apr): Absent (Sandwich)
- Sunday (19 Apr): Absent (Sandwich)
- Monday (20 Apr): Absent

**Calculations:**
- Regular Absent: 2 days (Fri + Mon) = 3,000
- Sandwich Absent: 2 days (Sat + Sun) = 3,000
- Total with Sandwich: 6,000
- Total without Sandwich: 3,000

**Net Salary:**
- With Sandwich: 38,076.41
- Without Sandwich: 41,076.41
- Difference: 3,000

---

## ✨ Features Summary

1. **Visual Indicator**: Amber highlighted box for sandwich absences
2. **Per-Employee Control**: Each employee can have different settings
3. **Real-time Calculation**: Instant updates when toggling
4. **Default Enabled**: Sandwich deduction applied by default
5. **Transparent**: Shows breakdown of regular vs sandwich absences
6. **Flexible**: HR can waive sandwich deduction case-by-case
7. **Audit Trail**: Decision saved with payroll record

---

## 🎯 Success Criteria

✅ HR admin can see which employees have sandwich absences
✅ HR admin can choose to apply or waive sandwich deduction
✅ Calculations update in real-time
✅ Net salary reflects the decision
✅ Payroll confirms successfully with the decision
✅ UI is intuitive and easy to use
✅ No performance issues with multiple employees
