const fs = require('fs');
let content = fs.readFileSync('app/page.js', 'utf8');

// 1. Add missing lucide-react icons
content = content.replace(
  /} from 'lucide-react';/,
  ", PlusCircle, Maximize2, Minimize2 } from 'lucide-react';"
);

// 2. Add states for expanded blocks
content = content.replace(
  "const [recentOrders, setRecentOrders] = useState([]);",
  "const [recentOrders, setRecentOrders] = useState([]);\n  const [debtsExpanded, setDebtsExpanded] = useState(true);\n  const [paymentsExpanded, setPaymentsExpanded] = useState(true);\n  const [ordersExpanded, setOrdersExpanded] = useState(true);"
);

// 3. Update fetchDashboard
content = content.replace(
  "setRecentPayments(data.recentPayments || []);",
  "setRecentPayments(data.recentPayments || []);\n            setRecentOrders(data.recentOrders || []);"
);

// 4. Wrap Debts widget content
content = content.replace(
  "height: '400px'",
  "height: debtsExpanded ? '400px' : 'auto', transition: 'height 0.3s ease'"
);

content = content.replace(
  /<h2 style={{ margin: 0, color: '#b91c1c', fontSize: '1.25rem' }}>חובות פתוחים<\/h2>\s*<\/div>/,
  \<h2 style={{ margin: 0, color: '#b91c1c', fontSize: '1.25rem' }}>חובות פתוחים</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setQuickPaymentOpen(true)} title="תשלום מהיר" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                <PlusCircle size={24} />
              </button>
              <button onClick={() => setDebtsExpanded(!debtsExpanded)} title={debtsExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {debtsExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {debtsExpanded && (\
);
content = content.replace(
  /<CreditCard size=\{40\} opacity=\{0.2\} \/>\s*<span>אין כרגע חובות פתוחים הממתינים לתשלום.<\/span>\s*<\/div>\s*<\/div>\s*<\/div>/,
  \<CreditCard size={40} opacity={0.2} />
                <span>אין כרגע חובות פתוחים הממתינים לתשלום.</span>
              </div>
            )}
          </div>
          )}
        </div>\
);

// 5. Wrap Recent Payments content
content = content.replace(
  "height: '400px' }",
  "height: paymentsExpanded ? '400px' : 'auto', transition: 'height 0.3s ease' }"
);

content = content.replace(
  /<h2 style={{ margin: 0, color: '#047857', fontSize: '1.25rem' }}>תשלומים אחרונים<\/h2>\s*<\/div>/,
  \<h2 style={{ margin: 0, color: '#047857', fontSize: '1.25rem' }}>תשלומים אחרונים</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setPaymentsExpanded(!paymentsExpanded)} title={paymentsExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(16, 185, 129, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {paymentsExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {paymentsExpanded && (\
);

content = content.replace(
  /<Banknote size=\{40\} opacity=\{0.2\} \/>\s*<span>טרם התקבלו תשלומים.<\/span>\s*<\/div>\s*<\/div>\s*<\/div>/,
  \<Banknote size={40} opacity={0.2} />
                <span>טרם התקבלו תשלומים.</span>
              </div>
            )}
          </div>
          )}
        </div>\
);

// 6. Add Recent Orders widget just before </main>
const recentOrdersHTML = \
        {/* Recent Orders Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: ordersExpanded ? '400px' : 'auto', transition: 'height 0.3s ease' }}>
          <div style={{ background: '#eff6ff', padding: '1.5rem', borderBottom: ordersExpanded ? '1px solid #dbeafe' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#3b82f6', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><ShoppingBag size={20} /></div>
              <h2 style={{ margin: 0, color: '#1d4ed8', fontSize: '1.25rem' }}>הזמנות אחרונות</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setOrdersExpanded(!ordersExpanded)} title={ordersExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(59, 130, 246, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {ordersExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {ordersExpanded && (
          <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
            {loadingDashboard ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" color="#3b82f6" /></div>
            ) : recentOrders.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentOrders.map(order => (
                  <li key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: '#dbeafe', color: '#1d4ed8', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                        #{order.orderId}
                      </div>
                      <div>
                        <Link href={\/orders/\\} style={{ fontWeight: '500', textDecoration: 'none', color: 'inherit' }}>{order.customer?.firstName} {order.customer?.lastName}</Link>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          {order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : (order.createdAt ? new Date(order.createdAt).toLocaleDateString('he-IL') : '-')}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#3b82f6' }}>
                      ₪{order.totalAmount || 0}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af', flexDirection: 'column', gap: '1rem' }}>
                <ShoppingBag size={40} opacity={0.2} />
                <span>אין הזמנות אחרונות.</span>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
      {quickPaymentOpen && (\;

content = content.replace(
  /<\/div>\s*\{quickPaymentOpen && \(/,
  recentOrdersHTML
);

fs.writeFileSync('app/page.js', content, 'utf8');
console.log('Success');
