/**
 * Export demand records from MySQL to ml/data/raw/demand_records.csv
 * Keeps server and ML cleanly decoupled without extra Python DB drivers.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function exportDemandData(outputPath) {
  const targetPath = outputPath || path.join(__dirname, '..', '..', 'ml', 'data', 'raw', 'demand_records.csv');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'food_waste_ai',
  });

  try {
    const [rows] = await conn.execute(`
      SELECT 
        food_item_id,
        DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date,
        quantity_prepared,
        quantity_sold,
        quantity_wasted
      FROM demand_records
      ORDER BY record_date ASC, food_item_id ASC
    `);

    const headers = ['food_item_id', 'record_date', 'quantity_prepared', 'quantity_sold', 'quantity_wasted'];
    const lines = [headers.join(',')];

    for (const r of rows) {
      lines.push(`${r.food_item_id},${r.record_date},${r.quantity_prepared},${r.quantity_sold},${r.quantity_wasted}`);
    }

    fs.writeFileSync(targetPath, lines.join('\n'), 'utf8');
    console.log(`Exported ${rows.length} demand records to ${targetPath}`);
    return { count: rows.length, path: targetPath };
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  exportDemandData().catch((err) => {
    console.error('Export failed:', err.message);
    process.exit(1);
  });
}

module.exports = { exportDemandData };
