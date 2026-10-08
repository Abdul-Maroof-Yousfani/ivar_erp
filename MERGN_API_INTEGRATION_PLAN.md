# Mergn API POS Integration Plan

Yeh plan batata hai ke Mergn POS API (Record Event aur Record Attribute APIs) ko IVAR POS system mein kaise integrate karna hai, jaisa ke `IVAR POS INTEGRATION.docx` document mein bataya gaya hai.

## Document Se Miliyee Jawab (Open Questions Resolved)

Main ne aapke system mein document ko dobara ghor se dekha hai aur jo sawal the, unke jawab mil gaye hain:

1. **Items ko array mein bhejna hai ya alag alag?**
   Jawab: **Aik hi list (array) mein.** Document mein clearly diya gaya hai: `["1PC - Stitched Basic Printed Cotton Silk Shirt", "1PC Stitched Basic Printed Lawn Shirt"]`. Iska matlab hai ke humein pooray order ko aik hi event (`eventId: 3586`) ke andar bhejna hai, aur agar order mein 2 items hain, to dono ka title aik list mein aayega, dono ka variant aik list mein, waghera.
2. **Kya property IDs static/fix hain?**
   Jawab: **Haan.** Document mein specifically IVAR ke liye hi mapping di gayi hai (jaise `eventId: 3586`, `eventPropertyId: 16003` Title ke liye). Toh hum in IDs ko hardcode/fix rakh kar hi code likhenge.
3. **Sirf POS Orders ya sab Sales Orders?**
   Jawab: Document ka naam hi "IVAR POS INTEGRATION" hai aur Platform ki property mein misaal `"POS"` di gayi hai, isliye yeh sirf POS orders ke checkout ke waqt chalna chahiye.

## Proposed Changes (Tajaweez Karda Tabdeelian)

### Configuration (Environment Variables)
Hum `.env` aur `.env.example` files mein Mergn API ki configuration add karenge.

#### [MODIFY] .env.example
- Add karein: `MERGN_API_URL=https://api.mergn.com/sdk-management/api`
- Add karein: `MERGN_API_TOKEN=eef3f5am526rgn4f8640adbbe232c5c16b48bccbaec767a3e750ee9e0f47d9039528b96`

---

### Mergn Integration Module
Hum `integration` module ke andar ek naya service banayenge jo Mergn API ki request background (asynchronously) handle karega taake POS ka checkout slow na ho.

#### [NEW] nestjs_backend/src/integration/mergn.service.ts
- Ek `MergnService` class banayenge jisme 2 methods honge: `recordEvent` aur `recordBulkAttribute`.
- `HttpService` ya `axios` use kar ke endpoints par POST request bhejenge.
- Ek event listener `@OnEvent('pos.order.created')` banayenge jo order create hone par order ka data receive karega.
- Customer ka phone number (`identity`) nikalenge. Agar phone number nahi hai, to API call skip kar denge.
- Order items ko `eventProperties` ke format mein map karenge (Har property ke andar ek array bhejenge jis mein order ke tamam items ki corresponding values hongi):
  - 16003: `[Item1 Title, Item2 Title]`
  - 16009: `[Item1 Variant, Item2 Variant]`
  - 16005: `[Item1 Vendor, Item2 Vendor]`
  - 15963: `"POS"`
  - 16002: Total Order Price (Sirf Number, e.g., 2500)
  - 16011: `[Item1 Type, Item2 Type]`
  - 43903: `"Clifton, Karachi"` (Branch Name)
- Customer ki details ko `record-bulk-attribute` API ke liye map karenge:
  - 2234: City
  - 2242: Email
  - 2238: First Name
  - 2241: Mobile Number

#### [MODIFY] nestjs_backend/src/integration/integration.module.ts
- `MergnService` ko module mein register aur export karenge.
- Agar `HttpModule` imported nahi hai, to usko add karenge.

---

### POS Sales Module
POS checkout flow ko modify karenge taake jab order success ho jaye to wo ek event fire (emit) kare.

#### [MODIFY] nestjs_backend/src/pos-sales/pos-sales.service.ts
- Constructor mein `EventEmitter2` ko inject karenge.
- `createOrder` method ke andar, jab `prisma.$transaction` complete ho jaye aur order save ho jaye, uske baad customer, location, aur items ki detail nikalenge.
- Us data ke sath event emit karenge: `this.eventEmitter.emit('pos.order.created', { order, customer, items, location })`.

## Verification Plan (Testing Kaise Hogi)

### Manual Verification
1. IVAR frontend se ek dummy POS Order create kar ke test karenge.
2. Backend logs check karenge ke `pos.order.created` event theek se chala ya nahi.
3. `MergnService` ke andar API calls ko verify karenge ke `record-event` aur `record-bulk-attribute` ka payload theek list/array format mein ban raha hai aur response `201 Created` aa raha hai.
