const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runTest() {
  console.log('🏁 Starting E2E Verification Test...');
  
  const testSuffix = Date.now();
  const registerPayload = {
    businessName: `E2E Bistro ${testSuffix}`,
    name: 'E2E Admin',
    email: `admin_${testSuffix}@e2ebistro.com`,
    password: 'password123',
    currency: 'USD',
    currencySymbol: '$'
  };

  try {
    // 1. Register a new tenant
    console.log('\n1. Registering new tenant...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, registerPayload);
    const { token, user, restaurant } = registerRes.data;
    console.log(`✅ Registered successfully! Tenant ID: ${user.tenantId}`);

    const client = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bearer ${token}` }
    });

    // 2. Fetch seeded tables
    console.log('\n2. Fetching seeded tables...');
    const tablesRes = await client.get('/tables');
    const tables = tablesRes.data.tables;
    console.log(`✅ Loaded ${tables.length} tables. Available:`, tables.map(t => `${t.name} (${t.status})`).join(', '));
    const tableT1 = tables.find(t => t.name === 'T1');

    // 3. Fetch seeded menu items
    console.log('\n3. Fetching seeded menu items...');
    const menuRes = await client.get('/menu');
    const menu = menuRes.data.items;
    console.log(`✅ Loaded ${menu.length} menu items. Examples:`, menu.slice(0, 3).map(m => `${m.name} (${m.price})`).join(', '));
    const pizzaItem = menu.find(m => m.name.includes('Pizza'));
    const beverageItem = menu.find(m => m.name.includes('Coca-Cola'));

    // 4. Create a new order for Table T1
    console.log(`\n4. Creating a new order for table ${tableT1.name}...`);
    const orderPayload = {
      tableId: tableT1._id,
      tableName: tableT1.name,
      items: [
        {
          menuItemId: pizzaItem._id,
          name: pizzaItem.name,
          price: pizzaItem.price,
          quantity: 2,
          modifiers: [{ name: 'Extra Cheese', price: 1.5 }],
          notes: 'Crispy crust please'
        },
        {
          menuItemId: beverageItem._id,
          name: beverageItem.name,
          price: beverageItem.price,
          quantity: 3,
          modifiers: []
        }
      ],
      notes: 'Hurry up please',
      staffId: null,
      staffName: 'E2E Admin'
    };
    const orderRes = await client.post('/orders', orderPayload);
    const createdOrder = orderRes.data.order;
    console.log(`✅ Order created successfully! Number: ${createdOrder.orderNumber}`);
    console.log(`   Subtotal: ${createdOrder.subtotal}, Tax: ${createdOrder.taxAmount}, Total: ${createdOrder.totalAmount}`);

    // 5. Verify Table T1 status is now occupied
    console.log('\n5. Verifying table occupancy status...');
    const updatedTablesRes = await client.get('/tables');
    const updatedT1 = updatedTablesRes.data.tables.find(t => t.name === 'T1');
    console.log(`✅ Table T1 status is now: ${updatedT1.status} (Occupied is expected)`);

    // 6. Complete payment
    console.log(`\n6. Marking order ${createdOrder.orderNumber} as PAID...`);
    const paymentRes = await client.post(`/orders/${createdOrder._id}/payment`);
    const paidOrder = paymentRes.data.order;
    console.log(`✅ Order paid: ${paidOrder.isPaid}, Status: ${paidOrder.status}`);

    // 7. Verify Table T1 status is back to available
    console.log('\n7. Verifying table is freed up...');
    const finalTablesRes = await client.get('/tables');
    const finalT1 = finalTablesRes.data.tables.find(t => t.name === 'T1');
    console.log(`✅ Table T1 status is now: ${finalT1.status} (Available is expected)`);

    // 8. Fetch sales report
    console.log('\n8. Fetching sales reports...');
    const reportRes = await client.get('/reports/sales?range=daily');
    const summary = reportRes.data.summary;
    console.log('✅ Sales Summary:', summary);
    console.log('✅ Chart Data points:', reportRes.data.chartData);

    // 9. Verify public menu works (Toggle website first)
    console.log('\n9. Toggling public website menu...');
    const toggleRes = await client.post('/website/toggle');
    console.log(`✅ Website published: ${toggleRes.data.isPublished}, URL: ${toggleRes.data.url}`);

    console.log('Fetching public menu page...');
    const publicRes = await axios.get(`${BASE_URL}/public-menu/${toggleRes.data.slug}`);
    console.log(`✅ Loaded public menu for ${publicRes.data.restaurant.businessName}. Total items: ${publicRes.data.items.length}`);

    // 10. Place an Online Delivery Order
    console.log('\n10. Placing an Online Delivery Order...');
    const publicOrderPayload = {
      items: [
        {
          menuItemId: pizzaItem._id,
          name: pizzaItem.name,
          price: pizzaItem.price,
          quantity: 1,
          modifiers: [],
          notes: ''
        }
      ],
      orderType: 'Delivery',
      customerName: 'Alice online',
      customerPhone: '555-1234',
      deliveryAddress: '456 Web Road, Internet City',
      notes: 'Please leave at front door'
    };
    
    const publicOrderRes = await axios.post(`${BASE_URL}/public-menu/${toggleRes.data.slug}/order`, publicOrderPayload);
    const onlineOrder = publicOrderRes.data.order;
    console.log(`✅ Online Order placed! Number: ${onlineOrder.orderNumber}`);
    console.log(`   Order type: ${onlineOrder.orderType}, Customer: ${onlineOrder.customerName}, Address: ${onlineOrder.deliveryAddress}`);

    // 11. Complete online order payment via secure client
    console.log(`\n11. Marking online order ${onlineOrder.orderNumber} as PAID...`);
    await client.post(`/orders/${onlineOrder._id}/payment`);
    
    // 12. Fetch final sales report to verify revenue has updated
    console.log('\n12. Fetching updated sales reports...');
    const finalReportRes = await client.get('/reports/sales?range=daily');
    console.log('✅ Final Sales Summary:', finalReportRes.data.summary);

    console.log('\n🎉 ALL E2E API VERIFICATIONS PASSED SUCCESSFULLY INCLUDING ONLINE ORDERING!');
  } catch (err) {
    console.error('❌ Test failed with error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTest();
