const fs = require('fs');
const file = 'app/admin/settings/page.js';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('inventory_include_warehouse')) {
  code = code.replace(
    /require_login: 'false'/,
    `require_login: 'false',\n    inventory_include_warehouse: 'false'`
  );

  code = code.replace(
    /'require_login': '.*?'/,
    `'require_login': 'חובת התחברות למערכת',
        'inventory_include_warehouse': 'ספירת מלאי מחסן'`
  );

  const newCheckbox = `
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', color: '#1e293b' }}>
              <input 
                type="checkbox" 
                name="inventory_include_warehouse" 
                checked={settings.inventory_include_warehouse === 'true'} 
                onChange={handleChange}
                style={{ marginLeft: '0.5rem', width: '20px', height: '20px' }}
              />
              הצג וספור במלאי גם פריטים הנמצאים במחסן/רזרבה
            </label>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem', marginRight: '2rem' }}>
              אם מסומן, מלאי שמוגדר במיקום מחסן או רזרבה ייספר כמלאי זמין ויוצג למשתמש. (ברירת מחדל: לא)
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
`;

  code = code.replace(
    /<div style=\{\{ marginBottom: '1\.5rem' \}\}>\s*<label style=\{\{ display: 'block', marginBottom: '0\.5rem', fontWeight: 'bold' \}\}>\s*.*?\(.*?\)\s*<\/label>/,
    newCheckbox + "              מסוף נדרים פלוס\n            </label>"
  );

  fs.writeFileSync(file, code, 'utf8');
  console.log('Settings updated successfully');
} else {
  console.log('Settings already updated');
}
