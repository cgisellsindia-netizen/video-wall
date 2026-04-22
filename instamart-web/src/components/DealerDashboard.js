import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, ShoppingBag, DollarSign, Package, BarChart3 } from 'lucide-react';
import { API_URL } from '../api';

function DealerDashboard({ user }) {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || (user.role !== 'dealer' && user.role !== 'distributor' && user.role !== 'admin')) {
      navigate('/');
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/products`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      setOrders(await oRes.json());
      setProducts(await pRes.json());
      setLoading(false);
    } catch (e) { setLoading(false); }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((s, o) => s + o.final_amount, 0);
  const isDistributor = user?.role === 'distributor';
  const discountLabel = isDistributor ? '15% Bulk Discount' : '10% Dealer Discount';

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '24px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <BarChart3 size={28} color="#f6c400" />
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>{isDistributor ? 'Distributor' : 'Dealer'} Dashboard</h2>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{user?.name} | {user?.email}</div>
        </div>
        <span style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '20px', background: '#f6c40020', color: '#082a63', fontSize: '13px', fontWeight: 700 }}>{discountLabel}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <ShoppingBag size={24} color="#f6c400" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{totalOrders}</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Total Orders</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <DollarSign size={24} color="#f6c400" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '24px', fontWeight: 800 }}>Rs {totalSpent.toLocaleString()}</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Total Spent</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Package size={24} color="#f6c400" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{products.length}</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Products Available</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <TrendingUp size={24} color="#f6c400" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{isDistributor ? '15%' : '10%'}</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>Your Discount</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`btn btn-sm ${activeTab === 'orders' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('orders')}>My Orders</button>
        <button className={`btn btn-sm ${activeTab === 'pricing' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('pricing')}>Special Pricing</button>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <h3 style={{ margin: '0 0 16px' }}>Welcome, {user?.name}</h3>
          <p style={{ color: '#64748b', lineHeight: 1.7 }}>
            As a {isDistributor ? 'distributor' : 'dealer'}, you get exclusive pricing on all CGI CCTV products.
            Place bulk orders directly through the shop or contact our sales team for project quotes.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={() => navigate('/shop')}>Browse Products</button>
            <button className="btn btn-outline" onClick={() => navigate('/contact')}>Request Project Quote</button>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Order #</th><th>Amount</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No orders yet. Start shopping to see your orders here.</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id}><td>#{o.id}</td><td>Rs {o.final_amount}</td><td><span className={`tag ${o.status === 'delivered' ? 'tag-success' : 'tag-warning'}`}>{o.status}</span></td><td>{o.payment_method?.toUpperCase()}</td><td>{new Date(o.created_at).toLocaleDateString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {products.slice(0, 8).map(p => {
            const dealerPrice = Math.round(p.price * (isDistributor ? 0.85 : 0.90));
            return (
              <div key={p.id} className="card">
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#082a63' }}>Rs {dealerPrice}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', textDecoration: 'line-through' }}>MRP: Rs {p.mrp}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#f6c40020', color: '#082a63', fontSize: '12px', fontWeight: 700 }}>{isDistributor ? '-15%' : '-10%'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DealerDashboard;
