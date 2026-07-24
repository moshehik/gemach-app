const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_sRbXgJ1uZj5v@ep-royal-dawn-asr9j84y-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require' });
pool.query('SELECT o."eventDateHebrew" as d, i."sizeText" as s FROM "OrderItem" i JOIN "Order" o ON i."orderId" = o.id JOIN "DressItem" di ON i."dressItemId" = di.id JOIN "DressModel" d ON di."dressModelId" = d.id WHERE d.name LIKE \'%אפור טול%\' AND i."sizeText" = \'36\'').then(res => { console.log(res.rows); pool.end(); }).catch(console.error);
