import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Shield, Users, ShoppingBag, Package, Plus, Trash2, Edit, MapPin, Truck } from 'lucide-react';
import { API_URL } from '../api';

function AdminPage({ user }) {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [partnerPasswords, setPartnerPasswords] = useState({});
  const [notificationForm, setNotificationForm] = useState({ title: '', message: '', target: 'customer' });
  const navigate = useNavigate();

  const emptyProduct = { name: '', description: '', price: '', mrp: '', discount_percent: '', dealer_price: '', distributor_price: '', image: '/images/cgi-new.jpg', category_id: '1', stock: '50', unit: '1 Unit' };
  const [form, setForm] = useState(emptyProduct);
  const emptyUser = { name: '', email: '', password: '', phone: '', address: '', role: 'dealer' };
  const [userForm, setUserForm] = useState(emptyUser);
  const emptyHub = { name: 'First Hub - CGI CCTV CAMERA INDIA H.O', address: 'CGI CCTV CAMERA INDIA H.O, Bhubaneswar, Odisha', lat: '20.2602964', lng: '85.8394521', map_url: 'https://share.google/UtXmTRALSt0cZk0gZ', active: true };
  const [hubForm, setHubForm] = useState(emptyHub);
  const [editHub, setEditHub] = useState(null);

  useEffect(() => { if (!user) { navigate('/'); return; } fetchData(); }, [user]);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [uRes, oRes, pRes, cRes, hRes, dRes] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/products`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/hubs`),
        fetch(`${API_URL}/admin/delivery-partners`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (uRes.status === 403 || oRes.status === 403) {
        setMessage('Admin access required. Login with the admin account to manage products.');
      }
      const [uData, oData, pData, cData, hData, dData] = await Promise.all([uRes.json(), oRes.json(), pRes.json(), cRes.json(), hRes.json(), dRes.json()]);
      setUsers(Array.isArray(uData) ? uData : []);
      setOrders(Array.isArray(oData) ? oData : []);
      setProducts(Array.isArray(pData) ? pData : []);
      setCategories(Array.isArray(cData) ? cData : []);
      setHubs(Array.isArray(hData) ? hData : []);
      setDeliveryPartners(Array.isArray(dData) ? dData : []);
      setLoading(false);
    } catch (e) { setMessage('Could not load admin data. Check backend/login and try again.'); setLoading(false); }
  };

  const handleSaveHub = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const body = { ...hubForm, lat: parseFloat(hubForm.lat), lng: parseFloat(hubForm.lng), active: Boolean(hubForm.active) };
    const url = editHub ? `${API_URL}/admin/hubs/${editHub.id}` : `${API_URL}/admin/hubs`;
    const res = await fetch(url, {
      method: editHub ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? (editHub ? 'Hub updated.' : 'Hub added.') : (data.error || 'Hub save failed.'));
    if (res.ok) { setHubForm(emptyHub); setEditHub(null); fetchData(); }
  };

  const handleDeleteHub = async (id) => {
    if (!window.confirm('Delete this hub?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/hubs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setMessage(res.ok ? 'Hub deleted.' : 'Hub delete failed.');
    fetchData();
  };

  const handlePartnerDetail = async (partner, changes) => {
    const token = localStorage.getItem('token');
    const body = {
      vehicle_type: changes.vehicle_type ?? partner.vehicle_type ?? 'bike',
      vehicle_number: changes.vehicle_number ?? partner.vehicle_number ?? '',
      license_number: changes.license_number ?? partner.license_number ?? '',
      hub_id: changes.hub_id ?? partner.hub_id ?? (hubs[0]?.id || ''),
      active: changes.active ?? Boolean(partner.active ?? true),
      email: changes.email,
      phone: changes.phone,
      password: changes.password
    };
    const res = await fetch(`${API_URL}/admin/delivery-partners/${partner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Delivery partner details updated.' : (data.error || 'Update failed.'));
    if (res.ok) fetchData();
  };

  const handlePartnerPassword = async (partner) => {
    const password = (partnerPasswords[partner.id] || '').trim();
    if (password.length < 6) {
      setMessage('Delivery partner password must be at least 6 characters.');
      return;
    }
    await handlePartnerDetail(partner, { password });
    setPartnerPasswords(prev => ({ ...prev, [partner.id]: '' }));
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    setMessage(res.ok ? 'Product deleted.' : 'Delete failed. Make sure you are logged in as admin.');
    fetchData();
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Please login as admin before saving products.');
      return;
    }
    const body = {
      ...form,
      price: parseFloat(form.price),
      mrp: parseFloat(form.mrp),
      discount_percent: parseFloat(form.discount_percent || 0),
      dealer_price: form.dealer_price === '' ? null : parseFloat(form.dealer_price),
      distributor_price: form.distributor_price === '' ? null : parseFloat(form.distributor_price),
      category_id: parseInt(form.category_id),
      stock: parseInt(form.stock)
    };
    if (!body.name || !body.description || !Number.isFinite(body.price) || !Number.isFinite(body.mrp) || !Number.isInteger(body.category_id) || !Number.isInteger(body.stock)) {
      setMessage('Please fill product name, description, price, MRP, category, and stock correctly.');
      return;
    }
    let res;
    if (editProduct) {
      res = await fetch(`${API_URL}/admin/products/${editProduct.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    } else {
      res = await fetch(`${API_URL}/admin/products`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      setMessage('Admin session expired or invalid. Logout, login again as admin@instamart.com, then save.');
      return;
    }
    setMessage(res.ok ? (editProduct ? 'Product updated.' : 'Product created.') : (data.error || 'Save failed. Check required fields.'));
    if (res.ok) {
      setShowForm(false); setEditProduct(null); setForm(emptyProduct); fetchData();
    }
  };

  const startEdit = (p) => { setEditProduct(p); setForm({ name: p.name, description: p.description, price: p.price, mrp: p.mrp, discount_percent: p.discount_percent || '', dealer_price: p.dealer_price || '', distributor_price: p.distributor_price || '', image: p.image, category_id: p.category_id.toString(), stock: p.stock, unit: p.unit }); setShowForm(true); };

  const handleImageFile = (file) => {
    if (!file) return;
    if (file.size > 650000) {
      setMessage('Please choose a smaller image under 650 KB for web/app upload.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, image: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(notificationForm)
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Notification sent to app.' : (data.error || 'Notification failed.'));
    if (res.ok) setNotificationForm({ title: '', message: '', target: 'customer' });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(userForm)
    });
    const data = await res.json();
    setMessage(res.ok ? `Created ${data.role} login: ${data.email} / ${data.password}` : (data.error || 'User creation failed'));
    if (res.ok) { setUserForm(emptyUser); fetchData(); }
  };

  if (loading) return <div className="loading">Loading admin panel...</div>;

  return (
    <div className="container" style={{ maxWidth: '1200px', padding: '24px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Shield size={28} color="#f6c400" />
        <h2 className="section-title" style={{ margin: 0 }}>Admin Dashboard</h2>
      </div>

      {message && <div className="admin-message">{message}</div>}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}><Users size={16} /> Users ({users.length})</button>
        <button className={`btn btn-sm ${activeTab === 'orders' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('orders')}><ShoppingBag size={16} /> Orders ({orders.length})</button>
        <button className={`btn btn-sm ${activeTab === 'products' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('products')}><Package size={16} /> Products ({products.length})</button>
        <button className={`btn btn-sm ${activeTab === 'delivery' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('delivery')}><Truck size={16} /> Delivery Partners ({deliveryPartners.length})</button>
        <button className={`btn btn-sm ${activeTab === 'hubs' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('hubs')}><MapPin size={16} /> Hubs ({hubs.length})</button>
        <button className={`btn btn-sm ${activeTab === 'notifications' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('notifications')}><Bell size={16} /> Notifications</button>
      </div>

      {activeTab === 'users' && (
        <div>
          <div className="card" style={{ marginBottom: '18px' }}>
            <h3 style={{ marginTop: 0 }}>Create staff / trade login</h3>
            <form className="admin-product-form" onSubmit={handleCreateUser}>
              <div className="form-group"><label>Name</label><input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required /></div>
              <div className="form-group"><label>Login ID</label><input type="text" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required /></div>
              <div className="form-group"><label>Password</label><input value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required /></div>
              <div className="form-group"><label>Phone</label><input value={userForm.phone} onChange={e => setUserForm({...userForm, phone: e.target.value})} /></div>
              <div className="form-group"><label>Address</label><input value={userForm.address} onChange={e => setUserForm({...userForm, address: e.target.value})} /></div>
              <div className="form-group"><label>Role</label><select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}><option value="dealer">Dealer</option><option value="distributor">Distributor</option><option value="delivery_partner">Delivery Partner</option><option value="user">Customer</option><option value="admin">Admin</option></select></div>
              <button className="btn btn-primary" type="submit">Create Login</button>
            </form>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Created</th></tr></thead>
              <tbody>{users.map(u => (<tr key={u.id}><td>{u.id}</td><td>{u.name}</td><td>{u.email}</td><td>{u.phone}</td><td><span className={`tag ${u.role === 'admin' ? 'tag-warning' : u.role === 'dealer' ? 'tag-info' : u.role === 'distributor' ? 'tag-success' : ''}`}>{u.role}</span></td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>))}</tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Email</th><th>Amount</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
              <tbody>{orders.map(o => (<tr key={o.id}><td>#{o.id}</td><td>{o.user_name}</td><td>{o.email}</td><td>Rs {o.final_amount}</td><td><span className={`tag ${o.status === 'delivered' ? 'tag-success' : o.status === 'pending' ? 'tag-warning' : 'tag-info'}`}>{o.status}</span></td><td>{o.payment_method.toUpperCase()}</td><td>{new Date(o.created_at).toLocaleDateString()}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'delivery' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <h3 style={{ marginTop: 0 }}>Delivery partner details</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Login ID</th><th>Mobile</th><th>Password</th><th>Vehicle</th><th>Vehicle No</th><th>License</th><th>Hub</th><th>Status</th></tr></thead>
              <tbody>{deliveryPartners.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td><input value={p.email || ''} onBlur={e => handlePartnerDetail(p, { email: e.target.value })} onChange={e => setDeliveryPartners(prev => prev.map(item => item.id === p.id ? { ...item, email: e.target.value } : item))} placeholder="partner ID" /></td>
                  <td><input value={p.phone || ''} onBlur={e => handlePartnerDetail(p, { phone: e.target.value })} onChange={e => setDeliveryPartners(prev => prev.map(item => item.id === p.id ? { ...item, phone: e.target.value } : item))} placeholder="mobile number" /></td>
                  <td>
                    <div className="partner-password-cell">
                      <span className="partner-current-pass">Current: {p.plaintext_password || 'hidden'}</span>
                      <div className="partner-password-row">
                        <input
                          type="text"
                          value={partnerPasswords[p.id] || ''}
                          onChange={e => setPartnerPasswords(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="New password"
                        />
                        <button className="btn btn-sm btn-primary" type="button" onClick={() => handlePartnerPassword(p)}>Save</button>
                      </div>
                    </div>
                  </td>
                  <td><select value={p.vehicle_type || 'bike'} onChange={e => handlePartnerDetail(p, { vehicle_type: e.target.value })}><option value="bike">Bike</option><option value="tempo">Tempo</option><option value="truck">Truck</option></select></td>
                  <td><input value={p.vehicle_number || ''} onChange={e => handlePartnerDetail(p, { vehicle_number: e.target.value })} placeholder="OD-02..." /></td>
                  <td><input value={p.license_number || ''} onChange={e => handlePartnerDetail(p, { license_number: e.target.value })} placeholder="License" /></td>
                  <td><select value={p.hub_id || ''} onChange={e => handlePartnerDetail(p, { hub_id: e.target.value })}>{hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></td>
                  <td><button className="btn btn-sm btn-outline" onClick={() => handlePartnerDetail(p, { active: !p.active })}>{p.active ? 'Active' : 'Inactive'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Send app notification</h3>
          <form className="admin-product-form" onSubmit={handleSendNotification}>
            <div className="form-group"><label>Title</label><input value={notificationForm.title} onChange={e => setNotificationForm({...notificationForm, title: e.target.value})} required /></div>
            <div className="form-group"><label>Target App</label><select value={notificationForm.target} onChange={e => setNotificationForm({...notificationForm, target: e.target.value})}><option value="customer">Customer app</option><option value="delivery">Delivery partner app</option><option value="all">Both apps</option></select></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Message</label><textarea value={notificationForm.message} onChange={e => setNotificationForm({...notificationForm, message: e.target.value})} rows="3" required /></div>
            <button className="btn btn-primary" type="submit">Send Notification</button>
          </form>
        </div>
      )}

      {activeTab === 'hubs' && (
        <div>
          <div className="card" style={{ marginBottom: '18px' }}>
            <h3 style={{ marginTop: 0 }}>{editHub ? 'Edit Camigo hub' : 'Add Camigo hub'}</h3>
            <form className="admin-product-form" onSubmit={handleSaveHub}>
              <div className="form-group"><label>Hub Name</label><input value={hubForm.name} onChange={e => setHubForm({...hubForm, name: e.target.value})} required /></div>
              <div className="form-group"><label>Address</label><input value={hubForm.address} onChange={e => setHubForm({...hubForm, address: e.target.value})} /></div>
              <div className="form-group"><label>Latitude</label><input type="number" step="any" value={hubForm.lat} onChange={e => setHubForm({...hubForm, lat: e.target.value})} required /></div>
              <div className="form-group"><label>Longitude</label><input type="number" step="any" value={hubForm.lng} onChange={e => setHubForm({...hubForm, lng: e.target.value})} required /></div>
              <div className="form-group"><label>Google Map URL</label><input value={hubForm.map_url} onChange={e => setHubForm({...hubForm, map_url: e.target.value})} /></div>
              <div className="form-group"><label>Active Hub</label><select value={hubForm.active ? '1' : '0'} onChange={e => setHubForm({...hubForm, active: e.target.value === '1'})}><option value="1">Active</option><option value="0">Inactive</option></select></div>
              <button className="btn btn-primary" type="submit">{editHub ? 'Update Hub' : 'Add Hub'}</button>
              {editHub && <button className="btn btn-outline" type="button" onClick={() => { setEditHub(null); setHubForm(emptyHub); }}>Cancel</button>}
            </form>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Address</th><th>Lat/Lng</th><th>Map</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{hubs.map(h => (
                  <tr key={h.id}>
                    <td>{h.name}</td>
                    <td>{h.address}</td>
                    <td>{h.lat}, {h.lng}</td>
                    <td>{h.map_url ? <a href={h.map_url} target="_blank" rel="noreferrer">Open</a> : '-'}</td>
                    <td>{h.active ? <span className="tag tag-success">Active</span> : <span className="tag">Inactive</span>}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => { setEditHub(h); setHubForm({ name: h.name, address: h.address || '', lat: h.lat, lng: h.lng, map_url: h.map_url || '', active: Boolean(h.active) }); }}><Edit size={14} /></button>
                      <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white', marginLeft: 8 }} onClick={() => handleDeleteHub(h.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Product Management</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditProduct(null); setForm(emptyProduct); }}><Plus size={16} /> Add Product</button>
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px' }}>{editProduct ? 'Edit Product' : 'Add New Product'}</h4>
              <form onSubmit={handleSaveProduct} className="admin-product-form">
                <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
                <div className="form-group"><label>Price</label><input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required /></div>
                <div className="form-group"><label>MRP</label><input type="number" value={form.mrp} onChange={e => setForm({...form, mrp: e.target.value})} required /></div>
                <div className="form-group"><label>Discount % Label</label><input type="number" value={form.discount_percent} onChange={e => setForm({...form, discount_percent: e.target.value})} placeholder="Auto if blank" /></div>
                <div className="form-group"><label>Dealer Price</label><input type="number" value={form.dealer_price} onChange={e => setForm({...form, dealer_price: e.target.value})} placeholder="Optional" /></div>
                <div className="form-group"><label>Distributor Price</label><input type="number" value={form.distributor_price} onChange={e => setForm({...form, distributor_price: e.target.value})} placeholder="Optional" /></div>
                <div className="form-group"><label>Stock</label><input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} required /></div>
                <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} required /></div>
                <div className="form-group"><label>Category</label>
                  <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Image Path / URL</label><input value={form.image} onChange={e => setForm({...form, image: e.target.value})} required /></div>
                <div className="form-group"><label>Browse Product Photo</label><input type="file" accept="image/*" onChange={e => handleImageFile(e.target.files?.[0])} /></div>
                <div className="admin-image-preview">
                  <span>Image preview</span>
                  <img src={form.image || '/images/cgi-hd3e.jpg'} alt="Product preview" />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary">{editProduct ? 'Update' : 'Create'}</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Dealer</th><th>Distributor</th><th>MRP</th><th>Stock</th><th>Category</th><th>Actions</th></tr></thead>
                <tbody>{products.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>Rs {p.price}</td>
                    <td>{p.dealer_price ? `Rs ${p.dealer_price}` : '-'}</td>
                    <td>{p.distributor_price ? `Rs ${p.distributor_price}` : '-'}</td>
                    <td>Rs {p.mrp}</td>
                    <td>{p.stock}</td>
                    <td>{p.category_name || categories.find(c => c.id === p.category_id)?.name}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" style={{ marginRight: '8px' }} onClick={() => startEdit(p)}><Edit size={14} /></button>
                      <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }} onClick={() => handleDeleteProduct(p.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
