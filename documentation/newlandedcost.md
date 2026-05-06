# Landed Cost Flow Documentation (Roman Urdu)

Is document mein Landed Cost system ka mukammal flow bataya gaya hai, Direct PO se lekar final stock posting tak.

## 1. Direct Purchase Order (PO)
Sab se pehle aap **Purchase Order** create karte hain. 
- Items select karein aur unki **Unit Price ($)** enter karein.
- PO ko submit karein taake wo system mein register ho jaye.

## 2. Goods Received Note (GRN)
Jab mal receive hota hai, to aap **GRN** banate hain.
- Select karein ke kis PO ke against mal aaya hai.
- Jitni quantity receive hui hai wo enter karein.
- GRN ko **SUBMIT** ya **RECEIVED_UNVALUED** status mein hona chahiye taake Landed Cost setup mein nazar aaye.

## 3. Landed Cost Setup - Selection
Ab **Landed Cost Setup** page par jayein:
- **Select GRN**: Dropdown se apna GRN select karein.
- **Shipment Details**: Table ke shuru mein ab LC No, B/L No, B/L Date, GD No, Origin, Season, Category, aur Shipping Invoice ki columns add kar di gayi hain taake poora data ek hi jagah nazar aaye.
  - **Note**: LC Date aur GD Date fields remove kar diye gaye hain (zaroorat nahi thi).
  - **Category Column**: Agar item ki category hai to show hogi, warna "-" show hoga.
- **Auto-Population**: Jaise hi GRN select hoga, tamam items automatically table mein aa jayenge.
- **HS Code Sync**: System background mein har item ka **HS Code** aur uske tax rates (CD, RD, ACD, ST, AST, IT, Excise) fetch kar lega.

## 4. Header & MIS Detail Entry
Table ke upar diye gaye boxes mein valuation details enter karein:
- **Ex. Rate**: Global exchange rate enter karein.
- **Total Invoice Value**: Manual total invoice value ($) enter karein (Ye distribution ke liye denominator ka kaam karta hai).
- **Other Charges (MIS Detail)**:
    - **Freight Section**: Is mein **US$ ($)** enter karein aur **(Ex. rate other)** enter karein. 
    - **Other Sections**: DO/THC, Bank, Insurance, aur Clg/Fwd ke totals enter karein.
    - Saath mein metadata (Invoice No, Policy No, Bill No) bhi enter karein jo har line item ke saath map ho jayengi.

## 5. Automated Calculations (The Formulas)
System neeche diye gaye rules ke mutabiq calculations karta hai:

### A. Freight & MIS Distribution
Tamam charges proportionally distribute hote hain:
- **Formula**: `(Total Charge from Form / Total Invoice Value) * Individual Row Inv ($)`
- **Freight PKR**: `FREIGHT (MIS) $` × `(Ex. rate other)`

### B. Duty & Tax Calculations (Sequential Logic)
Tamam duties aur taxes ab ek hi **DUTY CALCULATION** section ke niche hain. Sath hi **EXCISE** ka column bilkul Duties ke sath show hota hai:
1. **Assessable Value (AV)**: `(Invoice $ + Freight $) * Ex. Rate` + Insurance (1%) + Landing (1%).
2. **Duties**: CD, RD, aur ACD hamesha **AV** par calculate hote hain.
3. **Excise Charges**: Ye HS Code module se map ho kar automatically calculate hota hai: `(AV * HS Code Excise %) / 100`.
4. **Sales Tax (ST/AST)**: Ye `(AV + CD + RD + ACD)` par calculate hote hain (Adjustable hain, isliye Total Cost ka hisa nahi banay gaye).
5. **Income Tax (IT)**: Ye `(Value for Sales Tax + ST + AST)` par calculate hota hai (Adjustable).
6. **Total Duty**: In tamam taxes aur duties ka total sum hota hai.

### C. Total Other Charges
**Total Other** column mein niche diye gaye MIS charges ka plus (sum) show hota hai:
- `Freight MIS PKR + DO/THC + Bank + Insurance + Clg/Fwd`
*(Note: Excise calculation ab formula based hai isliye isko MIS section se nikal diya gaya hai)*

### D. Final Costing
- **Total Cost (PKR)** ka formula exactly ye hai:
  `Total Cost = (Inv $ * Ex. Rate) + CD + RD + ACD + Excise Charges + Total Other`
  *(Note: Isme freight aur adjustable taxes double count nahi hote)*
- **Unit Cost (PKR)**: `Total Cost / Qty`.

## 6. Post Landed Cost & Report
Jab calculations verify ho jayein:
- **Post Landed Cost**: Is button par click karne se sara data backend par save ho jata hai.
- **Auto-Redirect**: Save hone ke baad system automatically aapko **Landed Cost Report** page (`/erp/procurement/landed-cost/report/[id]`) par le jata hai.
- **Printable Report**:
    - Is page par aapko header info aur items ka detailed breakdown Nazar ayega.
    - "Print Report" button (ya `Ctrl+P`) se aap iska professional printout nikal saktay hain.
    - Is report mein Header (LC#, BL#, GD#, etc.) aur Items (Qty, FOB, Duties, Taxes, Excise, Total Cost) ki mukammal detail shamil hoti hai.

## 6. Layout Updates
- **ASSESSABLE VALUE**: Is section mein **Freight ($)** ke theek aagay **Ex. Rate** ka column add kiya gaya hai jo top form se global Ex. Rate uthata hai.
- **EXCISE**: Ye column ab DUTY CALCULATION ke right side par ek alag purple color mein aata hai.

## 7. Backend Integration
Jab aap "Post" click karte hain, background mein ye kaam hote hain:
1. ✅ Landed Cost record DB mein save hota hai (LC-000001 format mein auto-number).
2. ✅ GRN status update hota hai: `RECEIVED_UNVALUED` → `VALUED`.
3. ✅ Stock Ledger entries automatically create hoti hain har item ke liye (Unit Cost ke saath).
4. ✅ Inventory valuation update ho jati hai.
  
- **Data Saved**:
  - Header: GRN, Supplier, LC No, B/L No, B/L Date, GD No, Origin, Season, Category, Shipping Invoice, Currency, Exchange Rate
  - Items: Har item ka complete breakdown (Qty, FOB, Freight, Insurance, Landing, AV, CD, RD, ACD, ST, AST, IT, Excise, Other Charges, Unit Cost, Total Cost)
  - MIS Details: Freight Invoice No/Date, DO/THC PO/Date, Insurance Policy No, Clg/Fwd Bill No

## 8. Validation & Error Handling
- ✅ Duplicate check: Agar GRN already valued hai to error aayega
- ✅ Required fields: GRN aur Supplier mandatory hain
- ✅ Transaction safety: Sab kuch ek transaction mein hota hai (rollback on error)
- ✅ Item validation: Har item ka existence check hota hai

---
*Note: Ye poora flow real-time calculations, automated mapping, aur complete backend integration ke saath design kiya gaya hai.*
