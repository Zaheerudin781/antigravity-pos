const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');

const getDateRange = (range, startDate, endDate) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  if (range === 'daily') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'weekly') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
};

exports.getSalesReport = async (req, res) => {
  try {
    const { range = 'daily', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);

    const orders = await Order.find({
      tenantId: req.tenantId,
      isPaid: true,
      paidAt: { $gte: start, $lte: end },
    });

    const menuItems = await MenuItem.find({ tenantId: req.tenantId });
    const tables = await Table.find({ tenantId: req.tenantId });

    // COGS and margins calculation
    const costMap = {};
    menuItems.forEach(item => {
      costMap[item.name.toLowerCase()] = item.costPrice || 0;
      if (item._id) costMap[item._id.toString()] = item.costPrice || 0;
    });

    let totalCOGS = 0;
    let netSales = 0;
    let grossSales = 0;
    let taxCollected = 0;
    const totalOrders = orders.length;

    const itemMap = {};
    const categoryMap = {};
    const tableMap = {};
    const roomMap = {};
    const typeMap = {
      'Dine-In': { type: 'Dine-In', revenue: 0, count: 0 },
      'Takeaway': { type: 'Takeaway', revenue: 0, count: 0 },
      'Delivery': { type: 'Delivery', revenue: 0, count: 0 }
    };

    const tableToRoomMap = {};
    tables.forEach(t => {
      tableToRoomMap[t.name.toLowerCase()] = t.section || 'Main Room';
    });

    orders.forEach(o => {
      netSales += o.subtotal || 0;
      grossSales += o.totalAmount || 0;
      taxCollected += o.taxAmount || 0;

      // Group by order type
      const oType = o.orderType || 'Takeaway';
      if (!typeMap[oType]) typeMap[oType] = { type: oType, revenue: 0, count: 0 };
      typeMap[oType].revenue += o.subtotal || 0;
      typeMap[oType].count += 1;

      // Group by table and room
      if (o.orderType === 'Dine-In') {
        const tblKey = o.tableName || 'Unknown Table';
        if (!tableMap[tblKey]) tableMap[tblKey] = { tableName: tblKey, revenue: 0, orders: 0 };
        tableMap[tblKey].revenue += o.subtotal || 0;
        tableMap[tblKey].orders += 1;

        const roomName = tableToRoomMap[tblKey.toLowerCase()] || 'Main Room';
        if (!roomMap[roomName]) roomMap[roomName] = { roomName, revenue: 0, orders: 0 };
        roomMap[roomName].revenue += o.subtotal || 0;
        roomMap[roomName].orders += 1;
      }

      // Process items for COGS, best sellers, categories
      o.items.forEach(i => {
        const keyId = i.menuItemId ? i.menuItemId.toString() : '';
        const keyName = i.name ? i.name.toLowerCase() : '';
        const costPrice = costMap[keyId] !== undefined ? costMap[keyId] : (costMap[keyName] !== undefined ? costMap[keyName] : +(i.price * 0.35).toFixed(2));
        
        totalCOGS += (costPrice * i.quantity);

        // Best sellers map
        if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 };
        itemMap[i.name].qty += i.quantity;
        itemMap[i.name].revenue += i.subtotal || (i.price * i.quantity);

        // Category map
        let itemCat = 'Uncategorized';
        const matchedItem = menuItems.find(m => m.name.toLowerCase() === i.name.toLowerCase() || (i.menuItemId && m._id.toString() === i.menuItemId.toString()));
        if (matchedItem) itemCat = matchedItem.category;

        if (!categoryMap[itemCat]) categoryMap[itemCat] = { category: itemCat, revenue: 0, qty: 0 };
        categoryMap[itemCat].revenue += i.subtotal || (i.price * i.quantity);
        categoryMap[itemCat].qty += i.quantity;
      });
    });

    const netProfit = netSales - totalCOGS;
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;
    const avgOrderValue = totalOrders > 0 ? grossSales / totalOrders : 0;

    // Daily/Period chart data grouping
    const chartMap = {};
    orders.forEach(o => {
      const day = o.paidAt.toISOString().split('T')[0];
      chartMap[day] = (chartMap[day] || 0) + o.totalAmount;
    });
    const chartData = Object.entries(chartMap).map(([date, revenue]) => ({ date, revenue: parseFloat(revenue.toFixed(2)) })).sort((a, b) => a.date.localeCompare(b.date));

    // Best sellers
    const bestSellers = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Dead Stock
    const soldNames = new Set(Object.keys(itemMap).map(n => n.toLowerCase()));
    const deadStock = menuItems
      .filter(item => !soldNames.has(item.name.toLowerCase()))
      .map(item => ({ name: item.name, price: item.price, category: item.category }));

    // Category breakdown
    const categoryBreakdown = Object.values(categoryMap).map(c => ({
      ...c,
      revenue: parseFloat(c.revenue.toFixed(2))
    })).sort((a, b) => b.revenue - a.revenue);

    // Table & Room performances
    const tablePerformance = Object.values(tableMap).map(t => ({
      ...t,
      revenue: parseFloat(t.revenue.toFixed(2))
    })).sort((a, b) => b.revenue - a.revenue);

    const roomPerformance = Object.values(roomMap).map(r => ({
      ...r,
      revenue: parseFloat(r.revenue.toFixed(2))
    })).sort((a, b) => b.revenue - a.revenue);

    // Order Type comparison
    const orderTypePerformance = Object.values(typeMap).map(t => ({
      ...t,
      revenue: parseFloat(t.revenue.toFixed(2))
    }));

    res.json({
      success: true,
      summary: {
        grossSales: parseFloat(grossSales.toFixed(2)),
        netSales: parseFloat(netSales.toFixed(2)),
        taxCollected: parseFloat(taxCollected.toFixed(2)),
        totalCOGS: parseFloat(totalCOGS.toFixed(2)),
        netProfit: parseFloat(netProfit.toFixed(2)),
        profitMargin: parseFloat(profitMargin.toFixed(1)),
        totalOrders,
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2))
      },
      chartData,
      bestSellers,
      deadStock,
      categoryBreakdown,
      tablePerformance,
      roomPerformance,
      orderTypePerformance,
      orders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStaffReport = async (req, res) => {
  try {
    const { range = 'daily', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);
    const orders = await Order.find({
      tenantId: req.tenantId,
      isPaid: true,
      paidAt: { $gte: start, $lte: end },
    });

    const staffMap = {};
    orders.forEach(o => {
      const key = o.staffName || 'Unknown';
      if (!staffMap[key]) staffMap[key] = { name: key, orders: 0, revenue: 0 };
      staffMap[key].orders++;
      staffMap[key].revenue += o.totalAmount;
    });
    const staffReport = Object.values(staffMap).map(s => ({
      ...s,
      revenue: parseFloat(s.revenue.toFixed(2))
    })).sort((a, b) => b.revenue - a.revenue);

    res.json({ success: true, staffReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTopItems = async (req, res) => {
  try {
    const { range = 'daily', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);
    const orders = await Order.find({
      tenantId: req.tenantId,
      isPaid: true,
      paidAt: { $gte: start, $lte: end },
    });

    const itemMap = {};
    orders.forEach(o => {
      o.items.forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 };
        itemMap[i.name].qty += i.quantity;
        itemMap[i.name].revenue += i.subtotal || (i.price * i.quantity);
      });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    res.json({ success: true, topItems });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    const { range = 'daily', startDate, endDate } = req.query;
    const { start, end } = getDateRange(range, startDate, endDate);
    const orders = await Order.find({
      tenantId: req.tenantId,
      isPaid: true,
      paidAt: { $gte: start, $lte: end },
    }).sort({ paidAt: -1 });

    const rows = ['Order Number,Table,Staff,Items,Subtotal,Tax,Total,Date'];
    orders.forEach(o => {
      const items = o.items.map(i => `${i.name} x${i.quantity}`).join(' | ');
      rows.push(`${o.orderNumber},${o.tableName || 'N/A'},${o.staffName || 'N/A'},"${items}",${o.subtotal},${o.taxAmount},${o.totalAmount},${o.paidAt?.toISOString().split('T')[0]}`);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${range}-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(rows.join('\n'));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
