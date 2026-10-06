const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'root', password: 'P12a@2306',
    database: 'food_waste_ai'
  });

  const [tables] = await conn.execute('SHOW TABLES');
  console.log('Tables in food_waste_ai:');
  tables.forEach(t => console.log(' -', Object.values(t)[0]));

  const [cols] = await conn.execute('DESCRIBE demand_records');
  console.log('\ndemand_records columns:');
  cols.forEach(c => {
    console.log(` ${c.Field} | ${c.Type} | Null:${c.Null} | Key:${c.Key}`);
  });

  const [idx] = await conn.execute('SHOW INDEX FROM demand_records');
  const names = [...new Set(idx.map(i => i.Key_name))];
  console.log('\ndemand_records indexes:', names.join(', '));

  await conn.end();
  console.log('\nSchema verification complete.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
