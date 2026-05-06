// Copy-paste this in browser console on sales history page
// Press F12 → Console tab → Paste this code → Press Enter

(async () => {
    console.log('🔍 Testing Claims Data...\n');
    
    try {
        // Fetch sales orders
        const response = await fetch('/api/pos-sales/orders?limit=5');
        const data = await response.json();
        
        console.log('✅ API Response:', data);
        
        if (data.status && data.data && data.data.length > 0) {
            const firstOrder = data.data[0];
            
            console.log('\n📦 First Order:', {
                orderNumber: firstOrder.orderNumber,
                hasClaims: !!firstOrder.claims,
                claimsCount: firstOrder.claims?.length || 0,
                claims: firstOrder.claims
            });
            
            if (firstOrder.claims && firstOrder.claims.length > 0) {
                console.log('\n✅ CLAIMS DATA IS PRESENT!');
                console.log('Claim Details:', firstOrder.claims[0]);
            } else {
                console.log('\n❌ NO CLAIMS DATA FOUND');
                console.log('Possible reasons:');
                console.log('1. No claims exist for these orders');
                console.log('2. Backend not restarted after code changes');
                console.log('3. Prisma client not regenerated');
            }
            
            // Check specific order
            const orderWithClaim = 'SO-20260505-0031'; // Your order number
            const specificOrder = data.data.find(o => o.orderNumber === orderWithClaim);
            
            if (specificOrder) {
                console.log(`\n🎯 Order ${orderWithClaim}:`, {
                    hasClaims: !!specificOrder.claims,
                    claimsCount: specificOrder.claims?.length || 0,
                    claims: specificOrder.claims
                });
            } else {
                console.log(`\n⚠️ Order ${orderWithClaim} not found in current page`);
            }
            
        } else {
            console.log('❌ No orders found or API error');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
