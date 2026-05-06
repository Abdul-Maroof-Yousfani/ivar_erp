# Attendance Sandwich System (Roman Urdu)

## Kya Hai Ye Feature?

Sandwich System ek automatic rule hai jo weekend days (Saturday aur Sunday) ko absent mark kar deta hai jab employee Friday aur Monday dono din absent ho.

## Kaise Kaam Karta Hai?

### Basic Rule

Jab employee **absent** ho:
- **Friday** AUR **Monday** (weekend ke aas paas)
- **AUR na Friday par approved leave ho, na Monday par**

To system automatically:
- **Saturday** ko absent mark kar dega
- **Sunday** ko absent mark kar dega
- Note add karega: "Sandwich rule applied - absent due to Friday and Monday absence"

### Zaroori Exception: Approved Leaves
**Sandwich rule NAHI lagega agar:**
- Friday par approved leave application hai
- Monday par approved leave application hai
- Koi bhi approved leave Friday se Monday tak cover karti hai

Iska matlab hai ke jo employees ne legitimate approved leaves li hain, unhe weekend par sandwich rule se penalize nahi kiya jayega.

### Reverse Rule (Auto-Removal)

Jab employee ki status **absent** se **present** (ya koi aur status) ho jaye:
- **Friday** YA **Monday** par

To system automatically:
- **Saturday** aur **Sunday** se sandwich rule remove kar dega
- Weekend attendance records delete kar dega jo sandwich rule ne banaye the
- Manually banaye gaye weekend records preserve rahenge

## Example

**Example 1: Sandwich Rule Lagana**

*Pehle:*
- Friday (5 Jan): Absent ❌
- Saturday (6 Jan): Koi record nahi
- Sunday (7 Jan): Koi record nahi
- Monday (8 Jan): Absent ❌

*Baad mein (Sandwich Rule ke baad):*
- Friday (5 Jan): Absent ❌
- Saturday (6 Jan): Absent ❌ (Automatic sandwich rule se)
- Sunday (7 Jan): Absent ❌ (Automatic sandwich rule se)
- Monday (8 Jan): Absent ❌

**Example 2: Approved Leave - Sandwich Rule NAHI Lagega**

*Setup:*
- Friday (5 Jan): Absent ❌ (Approved leave hai)
- Saturday (6 Jan): Koi record nahi
- Sunday (7 Jan): Koi record nahi
- Monday (8 Jan): Absent ❌ (Approved leave hai)

*Result:*
- Friday (5 Jan): Absent ❌ (Approved leave)
- Saturday (6 Jan): Koi record nahi (Sandwich rule NAHI laga)
- Sunday (7 Jan): Koi record nahi (Sandwich rule NAHI laga)
- Monday (8 Jan): Absent ❌ (Approved leave)

**Example 3: Sandwich Rule Hatana**

*Pehle:*
- Friday (5 Jan): Absent ❌
- Saturday (6 Jan): Absent ❌ (Sandwich rule applied)
- Sunday (7 Jan): Absent ❌ (Sandwich rule applied)
- Monday (8 Jan): Absent ❌

*Friday ko Present karne ke baad:*
- Friday (5 Jan): Present ✅
- Saturday (6 Jan): Remove ho gaya (sandwich rule ne banaya tha)
- Sunday (7 Jan): Remove ho gaya (sandwich rule ne banaya tha)
- Monday (8 Jan): Absent ❌

## Deduction Impact

Weekend days jo sandwich rule se absent mark hue hain, wo shamil honge:
- **Payroll mein attendance deduction calculations mein** - Har absent weekend day ek full day deduction count hoga
- Attendance reports mein absence counts mein
- Monthly attendance summaries mein

### Payroll Weekend Absences Kaise Calculate Karta Hai

Payroll system ko update kiya gaya hai:
1. **Weekend/holidays par explicit absence records check karta hai** unhe skip karne se pehle
2. **Weekend absences ko count karta hai** jo sandwich rule ne banaye hain deduction calculations mein
3. **Per-day salary deduction apply karta hai** har absent weekend day ke liye

**Example Calculation:**
- Basic Salary: 45,000
- Mahine ke Din: 30
- Per Day Salary: 45,000 ÷ 30 = 1,500

Agar Friday, Saturday, Sunday, aur Monday sab absent hain:
- Absent Days: 4
- Deduction: 4 × 1,500 = **6,000**

Iska matlab hai ke employees deductions se bach nahi sakte sirf weekdays ko absent mark karke jab wo pura week off le rahe hain.

## Kab Trigger Hota Hai?

Sandwich rule automatically apply hota hai jab:
1. Naya attendance record banate hain status "absent" ke saath
2. Existing attendance record ko update karte hain status "absent" par

## Important Points

- Sandwich rule sirf "absent" status par lagta hai
- **Sandwich rule NAHI lagta agar Friday ya Monday par approved leave hai**
- Leave days is rule se affected nahi hote
- Weekend records jo sandwich rule ne banaye hain wo automatically remove ho jate hain agar Friday ya Monday ki status change ho
- Manually banaye gaye weekend attendance records preserve rahte hain
- Rule dono taraf se kaam karta hai (Friday ya Monday ko absent mark karne se check trigger hoga)
- System notes field use karta hai track karne ke liye ke kon se records sandwich rule ne banaye hain
- System leave application table check karta hai approved leaves ke liye sandwich rule apply karne se pehle

## Faida

Is feature se:
1. Employees pura week off nahi le sakte sirf weekdays absent mark karke
2. Payroll calculations zyada accurate hongi
3. Attendance tracking behtar hogi
4. Deductions properly apply honge
5. Management ko sahi attendance data milega
