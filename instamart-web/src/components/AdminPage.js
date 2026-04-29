import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Shield, Users, ShoppingBag, Package, Plus, Trash2, Edit, MapPin, Truck, Sparkles, FolderOpen, Image as ImageIcon, ArrowUp } from 'lucide-react';
import { API_URL } from '../api';

function AdminPage({ user }) {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [categoryBanners, setCategoryBanners] = useState([]);
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [partnerPasswords, setPartnerPasswords] = useState({});
  const [notificationForm, setNotificationForm] = useState({ title: '', message: '', target: 'customer', personalize: true, product_id: '', image_url: '' });
  const navigate = useNavigate();

  const emptyProduct = { name: '', description: '', price: '', mrp: '', discount_percent: '', dealer_price: '', distributor_price: '', warranty_years: '5', image: '/images/cgi-new.jpg', images: ['/images/cgi-new.jpg'], category_id: '1', stock: '50', unit: '1 Unit' };
  const [form, setForm] = useState(emptyProduct);
  const emptyUser = { name: '', email: '', password: '', phone: '', address: '', role: 'dealer' };
  const [userForm, setUserForm] = useState(emptyUser);
  const emptyHub = { name: 'First Hub - CGI CCTV CAMERA INDIA H.O', address: 'CGI CCTV CAMERA INDIA H.O, Bhubaneswar, Odisha', lat: '20.2602964', lng: '85.8394521', map_url: 'https://share.google/UtXmTRALSt0cZk0gZ', active: true };
  const [hubForm, setHubForm] = useState(emptyHub);
  const [editHub, setEditHub] = useState(null);
  const emptyBanner = { category_id: '0', image_url: '', width: '1200', height: '320', sort_order: '0', active: true };
  const [bannerForm, setBannerForm] = useState(emptyBanner);
  const [editBanner, setEditBanner] = useState(null);
  const [bannerUploadBusy, setBannerUploadBusy] = useState(false);
  const [aiBannerForm, setAiBannerForm] = useState({ category_id: '0', prompt: '', width: '1200', height: '320', theme: 'blue', sort_order: '0', active: true });
  const [aiBannerLoading, setAiBannerLoading] = useState(false);
  const [lastAiBanners, setLastAiBanners] = useState([]);
  const [mediaManifestUrl, setMediaManifestUrl] = useState('');
  const [mediaManifestBusy, setMediaManifestBusy] = useState(false);
  const [mediaBrowser, setMediaBrowser] = useState({ open: false, mode: 'cover', dir: '/', busy: false, data: null });

  useEffect(() => { if (!user) { navigate('/'); return; } fetchData(); }, [user]);

  const catalogBackupNotice = (data) => data?.catalog_warning ? ` ${data.catalog_warning}` : '';

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [uRes, oRes, pRes, cRes, hRes, dRes, bRes] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/products`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/categories`),
        fetch(`${API_URL}/hubs`),
        fetch(`${API_URL}/admin/delivery-partners`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/admin/category-banners`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (uRes.status === 403 || oRes.status === 403) {
        setMessage('Admin access required. Login with the admin account to manage products.');
      }
      const [uData, oData, pData, cData, hData, dData, bData] = await Promise.all([uRes.json(), oRes.json(), pRes.json(), cRes.json(), hRes.json(), dRes.json(), bRes.json()]);
      setUsers(Array.isArray(uData) ? uData : []);
      setOrders(Array.isArray(oData) ? oData : []);
      setProducts(Array.isArray(pData) ? pData : []);
      setCategories(Array.isArray(cData) ? cData : []);
      setHubs(Array.isArray(hData) ? hData : []);
      setDeliveryPartners(Array.isArray(dData) ? dData : []);
      setCategoryBanners(Array.isArray(bData) ? bData : []);
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
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Product deleted.${catalogBackupNotice(data)}` : (data.error || 'Delete failed. Make sure you are logged in as admin.'));
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
      warranty_years: Math.max(1, parseInt(form.warranty_years || '5', 10)),
      category_id: parseInt(form.category_id),
      stock: parseInt(form.stock),
      images: (Array.isArray(form.images) ? form.images : [])
        .map(item => String(item || '').trim())
        .filter(Boolean)
    };
    body.image = body.images[0] || body.image;
    if (!body.name || !body.description || !Number.isFinite(body.price) || !Number.isFinite(body.mrp) || !Number.isInteger(body.category_id) || !Number.isInteger(body.stock) || !Number.isInteger(body.warranty_years)) {
      setMessage('Please fill product name, description, price, MRP, warranty, category, and stock correctly.');
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
    setMessage(res.ok ? `${editProduct ? 'Product updated.' : 'Product created.'}${catalogBackupNotice(data)}` : (data.error || 'Save failed. Check required fields.'));
    if (res.ok) {
      setShowForm(false); setEditProduct(null); setForm(emptyProduct); fetchData();
    }
  };

  const startEdit = (p) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price,
      mrp: p.mrp,
      discount_percent: p.discount_percent || '',
      dealer_price: p.dealer_price || '',
      distributor_price: p.distributor_price || '',
      warranty_years: p.warranty_years || 5,
      image: p.image,
      images: Array.isArray(p.images) && p.images.length ? p.images : [p.image].filter(Boolean),
      category_id: p.category_id.toString(),
      stock: p.stock,
      unit: p.unit
    });
    setShowForm(true);
  };

  const handleImageFile = (file) => {
    if (!file) return;
    if (file.size > 650000) {
      setMessage('Please choose a smaller image under 650 KB for web/app upload.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(prev => {
      const nextImages = [...(prev.images || []), reader.result];
      return { ...prev, image: nextImages[0], images: nextImages };
    });
    reader.readAsDataURL(file);
  };

  const handleNotificationImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNotificationForm(prev => ({ ...prev, image_url: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleMultiImageFiles = (files) => {
    Array.from(files || []).forEach(file => handleImageFile(file));
  };

  const handleBannerImageFile = (file) => {
    if (!file) return;
    if (file.size > 950000) {
      setMessage('Please choose a category banner under 950 KB for fast mobile loading.');
      return;
    }
    setBannerUploadBusy(true);
    setMessage(`Reading banner file: ${file.name}`);
    const reader = new FileReader();
    reader.onload = () => {
      setBannerForm(prev => ({ ...prev, image_url: reader.result }));
      setBannerUploadBusy(false);
      setMessage(`Banner file loaded: ${file.name}`);
    };
    reader.onerror = () => {
      setBannerUploadBusy(false);
      setMessage('Could not read that banner file. Try another image.');
    };
    reader.readAsDataURL(file);
  };

  const handleCoverImageFile = (file) => {
    if (!file) return;
    if (file.size > 650000) {
      setMessage('Please choose a smaller cover photo under 650 KB for web/app upload.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((prev) => {
        const nextImages = [...(prev.images || [])];
        if (nextImages.length) nextImages[0] = reader.result;
        else nextImages.push(reader.result);
        return { ...prev, image: reader.result, images: nextImages };
      });
    reader.onerror = () => setMessage('Failed to read the selected cover photo. Please try another file.');
    reader.readAsDataURL(file);
  };

  const updateGalleryImage = (index, value) => {
    setForm(prev => {
      const nextImages = [...(prev.images || [])];
      nextImages[index] = value;
      return { ...prev, image: nextImages[0] || '', images: nextImages };
    });
  };

  const addGalleryField = () => {
    setForm(prev => ({ ...prev, images: [...(prev.images || []), ''] }));
  };

  const removeGalleryImage = (index) => {
    setForm(prev => {
      const nextImages = [...(prev.images || [])].filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, image: nextImages[0] || '', images: nextImages.length ? nextImages : [''] };
    });
  };

  const loadMediaLibrary = async (dir = '/', mode = mediaBrowser.mode || 'cover') => {
    const token = localStorage.getItem('token');
    setMediaBrowser(prev => ({ ...prev, open: true, mode, dir, busy: true }));
    try {
      const res = await fetch(`${API_URL}/admin/media/library?dir=${encodeURIComponent(dir)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not browse InfinityFree images.');
      setMediaBrowser(prev => ({ ...prev, open: true, mode, dir: data.dir || dir, data, busy: false }));
    } catch (error) {
      setMediaBrowser(prev => ({ ...prev, open: true, mode, dir, busy: false, data: null }));
      setMessage(error.message);
    }
  };

  const openMediaBrowser = (mode = 'cover') => {
    loadMediaLibrary(mediaBrowser.dir || '/', mode);
  };

  const chooseInfinityImage = (url) => {
    const imageUrl = String(url || '').trim();
    if (!imageUrl) return;
    if (mediaBrowser.mode === 'banner') {
      setBannerForm(prev => ({ ...prev, image_url: imageUrl }));
      setMessage('InfinityFree image selected as category banner.');
      return;
    }
    setForm(prev => {
      const nextImages = [...(prev.images || [])].filter(Boolean);
      if (mediaBrowser.mode === 'cover') {
        if (nextImages.length) nextImages[0] = imageUrl;
        else nextImages.push(imageUrl);
      } else if (!nextImages.includes(imageUrl)) {
        nextImages.push(imageUrl);
      }
      return { ...prev, image: nextImages[0] || imageUrl, images: nextImages };
    });
    setMessage(mediaBrowser.mode === 'cover' ? 'InfinityFree image selected as product cover.' : 'InfinityFree image added to product gallery.');
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
    if (res.ok) setNotificationForm({ title: '', message: '', target: 'customer', personalize: true, product_id: '', image_url: '' });
  };

  const handleSaveBanner = async (e) => {
    e.preventDefault();
    if (bannerUploadBusy) {
      setMessage('Banner file is still loading. Please wait a moment and click Add Banner again.');
      return;
    }
    if (!String(bannerForm.image_url || '').trim()) {
      setMessage('Please choose a banner file or paste a banner image URL first.');
      return;
    }
    const token = localStorage.getItem('token');
    const body = {
      ...bannerForm,
      category_id: parseInt(bannerForm.category_id, 10),
      width: parseInt(bannerForm.width, 10),
      height: parseInt(bannerForm.height, 10),
      sort_order: parseInt(bannerForm.sort_order, 10) || 0,
      active: Boolean(bannerForm.active)
    };
    const url = editBanner ? `${API_URL}/admin/category-banners/${editBanner.id}` : `${API_URL}/admin/category-banners`;
    const method = editBanner ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${editBanner ? 'Category banner updated.' : 'Category banner added.'}${catalogBackupNotice(data)}` : (data.error || 'Banner save failed.'));
    if (res.ok) {
      setBannerForm(emptyBanner);
      setEditBanner(null);
      fetchData();
    }
  };

  const startEditBanner = (banner) => {
    setEditBanner(banner);
    setBannerForm({
      category_id: String(banner.category_id),
      image_url: banner.image_url || '',
      width: String(banner.width || 1200),
      height: String(banner.height || 320),
      sort_order: String(banner.sort_order || 0),
      active: Boolean(banner.active)
    });
    setActiveTab('banners');
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm('Delete this category banner?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/category-banners/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Category banner deleted.${catalogBackupNotice(data)}` : (data.error || 'Banner delete failed.'));
    if (res.ok) fetchData();
  };

  const handleGenerateAiBanner = async (e) => {
    e.preventDefault();
    setAiBannerLoading(true);
    setMessage('Generating AI banner from current products and discounts...');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/admin/category-banners/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...aiBannerForm,
          category_id: parseInt(aiBannerForm.category_id, 10),
          width: parseInt(aiBannerForm.width, 10),
          height: parseInt(aiBannerForm.height, 10),
          sort_order: parseInt(aiBannerForm.sort_order, 10) || 0,
          active: Boolean(aiBannerForm.active),
          save: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'AI banner generation failed.');
      const generated = Array.isArray(data.generated) ? data.generated : (data.image_url ? [{ image_url: data.image_url, category_id: aiBannerForm.category_id, category_name: 'Selected position', copy: data.copy }] : []);
      setLastAiBanners(generated);
      if (generated[0]?.image_url) {
        setBannerForm(prev => ({ ...prev, image_url: generated[0].image_url, width: aiBannerForm.width, height: aiBannerForm.height, category_id: String(generated[0].category_id ?? aiBannerForm.category_id) }));
      }
      setMessage(data.message || `AI generated ${generated.length || 1} banner(s).`);
      fetchData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAiBannerLoading(false);
    }
  };

  const downloadMediaManifest = async () => {
    const token = localStorage.getItem('token');
    setMediaManifestBusy(true);
    setMessage('Preparing media backup JSON...');
    try {
      const res = await fetch(`${API_URL}/admin/media/manifest`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not export media backup.');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'camigo-catalog-backup.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage('Catalog backup downloaded. Upload this JSON to InfinityFree and set its public URL as MEDIA_MANIFEST_URL on Render.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setMediaManifestBusy(false);
    }
  };

  const importMediaManifest = async (payload) => {
    const token = localStorage.getItem('token');
    setMediaManifestBusy(true);
    setMessage('Restoring catalog data...');
    try {
      const res = await fetch(`${API_URL}/admin/media/manifest/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Media restore failed.');
      setMessage(data.message || 'Media restored.');
      fetchData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setMediaManifestBusy(false);
    }
  };

  const handleMediaManifestFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importMediaManifest({ manifest: JSON.parse(reader.result) });
      } catch (error) {
        setMessage('That JSON file could not be read. Please upload a valid Camigo catalog backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreMediaManifestUrl = () => {
    const url = mediaManifestUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setMessage('Paste a full public JSON URL starting with http:// or https://.');
      return;
    }
    importMediaManifest({ manifest_url: url });
  };

  const syncCatalogToFtp = async () => {
    const token = localStorage.getItem('token');
    setMediaManifestBusy(true);
    setMessage('Pushing catalog JSON to InfinityFree...');
    try {
      const res = await fetch(`${API_URL}/admin/media/manifest/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'FTP sync failed.');
      setMessage(data.message || 'Catalog JSON pushed to InfinityFree.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setMediaManifestBusy(false);
    }
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

  const handleAdminCancelOrder = async (order) => {
    if (!window.confirm(`Cancel order #${order.id}?`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/admin/orders/${order.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Order cancelled from admin panel.' : (data.error || 'Could not cancel order.'));
    if (res.ok) {
      setOrders(current => current.map(item => (
        item.id === order.id
          ? { ...item, status: 'cancelled', payment_status: data.payment_status }
          : item
      )));
    }
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
        <button className={`btn btn-sm ${activeTab === 'banners' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('banners')}><Package size={16} /> Category Banners ({categoryBanners.length})</button>
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
              <div className="form-group"><label>Role</label><select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}><option value="dealer">Dealer</option><option value="distributor">Distributor</option><option value="delivery_partner">Delivery Partner</option><option value="installer">Installer</option><option value="user">Customer</option><option value="admin">Admin</option></select></div>
              <button className="btn btn-primary" type="submit">Create Login</button>
            </form>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Created</th></tr></thead>
              <tbody>{users.map(u => {
                const showPhone = u.phone && (u.phone_verified || ['admin', 'delivery_partner', 'installer'].includes(u.role));
                return (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{showPhone ? u.phone : <span className="tag">Not verified</span>}</td>
                    <td><span className={`tag ${u.role === 'admin' ? 'tag-warning' : u.role === 'dealer' ? 'tag-info' : u.role === 'distributor' ? 'tag-success' : ''}`}>{u.role}</span></td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Email</th><th>Amount</th><th>Status</th><th>Payment</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>{orders.map(o => {
                const canCancel = !['cancelled', 'delivered'].includes(String(o.status || '').toLowerCase());
                return (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td>{o.user_name}</td>
                    <td>{o.email}</td>
                    <td>Rs {o.final_amount}</td>
                    <td><span className={`tag ${o.status === 'delivered' ? 'tag-success' : o.status === 'pending' ? 'tag-warning' : o.status === 'cancelled' ? '' : 'tag-info'}`}>{o.status}</span></td>
                    <td>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <strong>{o.payment_method?.toUpperCase?.() || '-'}</strong>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{o.payment_status || 'created'}</span>
                      </div>
                    </td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      {canCancel ? (
                        <button className="btn btn-sm btn-outline" onClick={() => handleAdminCancelOrder(o)}>Cancel</button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
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
            <div className="form-group"><label>Target App</label><select value={notificationForm.target} onChange={e => setNotificationForm({...notificationForm, target: e.target.value})}><option value="customer">Customer app</option><option value="delivery">Delivery partner app</option><option value="installer">Installer app</option><option value="all">All apps</option></select></div>
            <div className="form-group"><label>Open product on click</label><select value={notificationForm.product_id} onChange={e => setNotificationForm({...notificationForm, product_id: e.target.value})}><option value="">No product link</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
            <div className="form-group"><label>Customer first name</label><select value={notificationForm.personalize ? '1' : '0'} onChange={e => setNotificationForm({...notificationForm, personalize: e.target.value === '1'})}><option value="1">Add first name automatically</option><option value="0">Do not personalize</option></select></div>
            <div className="form-group"><label>Image URL</label><input value={notificationForm.image_url} onChange={e => setNotificationForm({...notificationForm, image_url: e.target.value})} placeholder="Optional image URL" /></div>
            <div className="form-group"><label>Upload image</label><input type="file" accept="image/*" onChange={e => handleNotificationImageFile(e.target.files?.[0])} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Message</label><textarea value={notificationForm.message} onChange={e => setNotificationForm({...notificationForm, message: e.target.value})} rows="3" required /></div>
            <p className="checkout-note" style={{ gridColumn: '1 / -1', margin: 0 }}>Tip: if personalization is on, customers see their first name before your message. Product link opens inside the app.</p>
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

      {activeTab === 'banners' && (
        <div>
          <div className="card" style={{ marginBottom: '18px', border: '1px solid rgba(11, 100, 255, .18)', background: '#f8fbff' }}>
            <h3 style={{ marginTop: 0 }}>Catalog backup for Render free</h3>
            <p className="checkout-note" style={{ marginTop: 0 }}>
              Render free can reset SQLite data. After you finish product prices, details, photos and banners, download this JSON, upload it to InfinityFree, then set the public JSON link as <strong>MEDIA_MANIFEST_URL</strong> in Render Environment.
            </p>
            <div className="admin-product-form">
              <button type="button" className="btn btn-primary" onClick={downloadMediaManifest} disabled={mediaManifestBusy}>
                Download full product catalog + photos + banners JSON
              </button>
              <div className="form-group">
                <label>Restore from JSON file</label>
                <input type="file" accept=".json,application/json" onChange={e => handleMediaManifestFile(e.target.files?.[0])} disabled={mediaManifestBusy} />
              </div>
              <div className="form-group">
                <label>Restore from public JSON URL</label>
                <input value={mediaManifestUrl} onChange={e => setMediaManifestUrl(e.target.value)} placeholder="https://your-host/camigo-catalog-backup.json" />
              </div>
              <button type="button" className="btn btn-outline" onClick={handleRestoreMediaManifestUrl} disabled={mediaManifestBusy}>
                Restore from URL now
              </button>
              <button type="button" className="btn btn-outline" onClick={syncCatalogToFtp} disabled={mediaManifestBusy}>
                Push latest JSON to InfinityFree now
              </button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '18px', border: '1px solid rgba(11, 100, 255, .18)', background: 'linear-gradient(135deg, #eef6ff, #fff9df)' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} /> AI banner generator</h3>
            <p className="checkout-note" style={{ marginTop: 0 }}>
              Generates a wide mobile banner by reading current products, MRP, prices and discount labels. It saves directly into the selected banner position.
            </p>
            <form className="admin-product-form" onSubmit={handleGenerateAiBanner}>
              <div className="form-group">
                <label>Banner Position</label>
                <select value={aiBannerForm.category_id} onChange={e => setAiBannerForm({ ...aiBannerForm, category_id: e.target.value })}>
                  <option value="all">All banner positions</option>
                  <option value="0">Above Shop by Category</option>
                  {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>AI Command</label>
                <input
                  value={aiBannerForm.prompt}
                  onChange={e => setAiBannerForm({ ...aiBannerForm, prompt: e.target.value })}
                  placeholder="Example: Make a same-day delivery banner for the best IP camera discount"
                />
              </div>
              <div className="form-group">
                <label>Theme</label>
                <select value={aiBannerForm.theme} onChange={e => setAiBannerForm({ ...aiBannerForm, theme: e.target.value })}>
                  <option value="blue">Camigo Blue</option>
                  <option value="yellow">Instamart Yellow</option>
                  <option value="green">Offer Green</option>
                  <option value="orange">Warm Orange</option>
                </select>
              </div>
              <div className="form-group"><label>Width</label><input type="number" value={aiBannerForm.width} onChange={e => setAiBannerForm({ ...aiBannerForm, width: e.target.value })} /></div>
              <div className="form-group"><label>Height</label><input type="number" value={aiBannerForm.height} onChange={e => setAiBannerForm({ ...aiBannerForm, height: e.target.value })} /></div>
              <div className="form-group"><label>Order</label><input type="number" value={aiBannerForm.sort_order} onChange={e => setAiBannerForm({ ...aiBannerForm, sort_order: e.target.value })} /></div>
              <button className="btn btn-primary" type="submit" disabled={aiBannerLoading}>
                {aiBannerLoading ? 'Generating...' : 'Generate and Save Banner'}
              </button>
            </form>
            {lastAiBanners.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ margin: '0 0 10px' }}>Latest generated banner previews</h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  {lastAiBanners.map((banner, index) => (
                    <div key={`${banner.category_id}-${index}`} style={{ border: '1px solid #dbe7f5', borderRadius: 16, padding: 10, background: '#fff' }}>
                      <strong>{banner.category_name || `Banner ${index + 1}`}</strong>
                      <img src={banner.image_url} alt={banner.category_name || 'Generated banner'} style={{ width: '100%', marginTop: 8, borderRadius: 14, objectFit: 'cover', aspectRatio: `${Number(aiBannerForm.width) || 1200} / ${Number(aiBannerForm.height) || 320}` }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '18px' }}>
            <h3 style={{ marginTop: 0 }}>{editBanner ? 'Edit category banner' : 'Add category banner'}</h3>
            <p className="checkout-note" style={{ marginTop: 0 }}>
              Recommended mobile-wide banner size: <strong>1200 x 320 px</strong>. Keep banners low in height and wide in width for best mobile fit.
            </p>
            <form className="admin-product-form" onSubmit={handleSaveBanner}>
              <div className="form-group">
                <label>Banner Position</label>
                <select value={bannerForm.category_id} onChange={e => setBannerForm(prev => ({ ...prev, category_id: e.target.value }))}>
                  <option value="0">Above Shop by Category</option>
                  {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Banner Image URL / Data</label><input value={bannerForm.image_url} onChange={e => setBannerForm(prev => ({ ...prev, image_url: e.target.value }))} required /></div>
              <div className="form-group"><label>Upload Banner</label><input type="file" accept="image/*" onChange={e => handleBannerImageFile(e.target.files?.[0])} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>InfinityFree banner library</label>
                <div className="infinity-picker-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openMediaBrowser('banner')}>
                    <ImageIcon size={15} /> Browse banner from FTP
                  </button>
                  <span>Select an uploaded InfinityFree banner image and its public URL will fill automatically.</span>
                </div>
              </div>
              {mediaBrowser.open && mediaBrowser.mode === 'banner' && (
                <div className="infinity-media-browser">
                  <div className="infinity-media-head">
                    <div>
                      <strong>Select category banner</strong>
                      <span>{mediaBrowser.data?.public_base || 'InfinityFree'}{mediaBrowser.data?.dir || mediaBrowser.dir}</span>
                    </div>
                    <div className="infinity-media-tools">
                      {mediaBrowser.data?.parent && (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => loadMediaLibrary(mediaBrowser.data.parent, mediaBrowser.mode)}>
                          <ArrowUp size={14} /> Up
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => loadMediaLibrary(mediaBrowser.dir, mediaBrowser.mode)} disabled={mediaBrowser.busy}>
                        Refresh
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setMediaBrowser(prev => ({ ...prev, open: false }))}>
                        Close
                      </button>
                    </div>
                  </div>
                  {mediaBrowser.busy && <div className="infinity-media-empty">Loading InfinityFree images...</div>}
                  {!mediaBrowser.busy && mediaBrowser.data?.directories?.length > 0 && (
                    <div className="infinity-folder-row">
                      {mediaBrowser.data.directories.map(folder => (
                        <button type="button" key={folder.dir} onClick={() => loadMediaLibrary(folder.dir, mediaBrowser.mode)}>
                          <FolderOpen size={16} /> {folder.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {!mediaBrowser.busy && mediaBrowser.data?.images?.length > 0 && (
                    <div className="infinity-image-grid infinity-banner-grid">
                      {mediaBrowser.data.images.map(image => (
                        <button type="button" key={image.url} className="infinity-image-card" onClick={() => chooseInfinityImage(image.url)}>
                          <img src={image.url} alt={image.name} loading="lazy" />
                          <span>{image.name}</span>
                          <small>Use as banner</small>
                        </button>
                      ))}
                    </div>
                  )}
                  {!mediaBrowser.busy && mediaBrowser.data && !mediaBrowser.data.images?.length && !mediaBrowser.data.directories?.length && (
                    <div className="infinity-media-empty">No image files found in this folder. Upload banner JPG, PNG, WEBP, GIF, AVIF, or SVG files to InfinityFree first.</div>
                  )}
                </div>
              )}
              <div className="form-group"><label>Banner Width (px)</label><input type="number" value={bannerForm.width} onChange={e => setBannerForm(prev => ({ ...prev, width: e.target.value }))} required /></div>
              <div className="form-group"><label>Banner Height (px)</label><input type="number" value={bannerForm.height} onChange={e => setBannerForm(prev => ({ ...prev, height: e.target.value }))} required /></div>
              <div className="form-group"><label>Order</label><input type="number" value={bannerForm.sort_order} onChange={e => setBannerForm(prev => ({ ...prev, sort_order: e.target.value }))} /></div>
              <div className="form-group"><label>Active</label><select value={bannerForm.active ? '1' : '0'} onChange={e => setBannerForm(prev => ({ ...prev, active: e.target.value === '1' }))}><option value="1">Active</option><option value="0">Inactive</option></select></div>
              <div className="admin-image-preview">
                <span>Banner preview</span>
                <img src={bannerForm.image_url || '/images/cgi-hd3e.jpg'} alt="Banner preview" style={{ objectFit: 'cover', aspectRatio: `${Number(bannerForm.width) || 1200} / ${Number(bannerForm.height) || 320}` }} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={bannerUploadBusy}>{bannerUploadBusy ? 'Loading banner...' : (editBanner ? 'Update Banner' : 'Add Banner')}</button>
              {editBanner && <button className="btn btn-outline" type="button" onClick={() => { setEditBanner(null); setBannerForm(emptyBanner); }}>Cancel</button>}
            </form>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Preview</th><th>Category</th><th>Size</th><th>Order</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{categoryBanners.map(banner => (
                  <tr key={banner.id}>
                    <td><img src={banner.image_url} alt={banner.category_name} style={{ width: '180px', height: '56px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #e5ebf3' }} /></td>
                    <td>{banner.category_name}</td>
                    <td>{banner.width} x {banner.height}</td>
                    <td>{banner.sort_order}</td>
                    <td>{banner.active ? <span className="tag tag-success">Active</span> : <span className="tag">Inactive</span>}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => startEditBanner(banner)}><Edit size={14} /></button>
                      <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white', marginLeft: 8 }} onClick={() => handleDeleteBanner(banner.id)}><Trash2 size={14} /></button>
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
                <div className="form-group"><label>Warranty Years</label><input type="number" min="1" value={form.warranty_years} onChange={e => setForm({...form, warranty_years: e.target.value})} required /></div>
                <div className="form-group"><label>Stock</label><input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} required /></div>
                <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} required /></div>
                <div className="form-group"><label>Category</label>
                  <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Cover Image Path / URL</label><input value={form.image} onChange={e => updateGalleryImage(0, e.target.value)} required /></div>
                <div className="form-group"><label>Browse Cover Photo</label><input type="file" accept="image/*" onChange={e => handleCoverImageFile(e.target.files?.[0])} /></div>
                <div className="form-group"><label>Browse Product Photos</label><input type="file" accept="image/*" multiple onChange={e => handleMultiImageFiles(e.target.files)} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>InfinityFree image library</label>
                  <div className="infinity-picker-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openMediaBrowser('cover')}>
                      <ImageIcon size={15} /> Browse for cover
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openMediaBrowser('gallery')}>
                      <Plus size={15} /> Add gallery image
                    </button>
                    <span>Shows images from your InfinityFree FTP so product photos stay permanent after Render redeploy.</span>
                  </div>
                </div>
                {mediaBrowser.open && ['cover', 'gallery'].includes(mediaBrowser.mode) && (
                  <div className="infinity-media-browser">
                    <div className="infinity-media-head">
                      <div>
                        <strong>{mediaBrowser.mode === 'cover' ? 'Select product cover' : 'Select gallery image'}</strong>
                        <span>{mediaBrowser.data?.public_base || 'InfinityFree'}{mediaBrowser.data?.dir || mediaBrowser.dir}</span>
                      </div>
                      <div className="infinity-media-tools">
                        {mediaBrowser.data?.parent && (
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => loadMediaLibrary(mediaBrowser.data.parent, mediaBrowser.mode)}>
                            <ArrowUp size={14} /> Up
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => loadMediaLibrary(mediaBrowser.dir, mediaBrowser.mode)} disabled={mediaBrowser.busy}>
                          Refresh
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setMediaBrowser(prev => ({ ...prev, open: false }))}>
                          Close
                        </button>
                      </div>
                    </div>
                    {mediaBrowser.busy && <div className="infinity-media-empty">Loading InfinityFree images...</div>}
                    {!mediaBrowser.busy && mediaBrowser.data?.directories?.length > 0 && (
                      <div className="infinity-folder-row">
                        {mediaBrowser.data.directories.map(folder => (
                          <button type="button" key={folder.dir} onClick={() => loadMediaLibrary(folder.dir, mediaBrowser.mode)}>
                            <FolderOpen size={16} /> {folder.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!mediaBrowser.busy && mediaBrowser.data?.images?.length > 0 && (
                      <div className="infinity-image-grid">
                        {mediaBrowser.data.images.map(image => (
                          <button type="button" key={image.url} className="infinity-image-card" onClick={() => chooseInfinityImage(image.url)}>
                            <img src={image.url} alt={image.name} loading="lazy" />
                            <span>{image.name}</span>
                            <small>{mediaBrowser.mode === 'cover' ? 'Use as cover' : 'Add to gallery'}</small>
                          </button>
                        ))}
                      </div>
                    )}
                    {!mediaBrowser.busy && mediaBrowser.data && !mediaBrowser.data.images?.length && !mediaBrowser.data.directories?.length && (
                      <div className="infinity-media-empty">No image files found in this folder. Upload JPG, PNG, WEBP, GIF, AVIF, or SVG files to InfinityFree first.</div>
                    )}
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Gallery Images</label>
                  <div className="admin-gallery-list">
                    {(form.images || []).map((img, index) => (
                      <div key={index} className="admin-gallery-row">
                        <input
                          value={img}
                          onChange={e => updateGalleryImage(index, e.target.value)}
                          placeholder={index === 0 ? 'Cover image URL' : `Gallery image ${index + 1}`}
                        />
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => removeGalleryImage(index)}>Remove</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-outline btn-sm" onClick={addGalleryField}>Add another photo field</button>
                  </div>
                </div>
                <div className="admin-image-preview">
                  <span>Image preview</span>
                  <img src={(form.images && form.images[0]) || form.image || '/images/cgi-hd3e.jpg'} alt="Product preview" />
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
                <thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Dealer</th><th>Distributor</th><th>Warranty</th><th>MRP</th><th>Stock</th><th>Category</th><th>Actions</th></tr></thead>
                <tbody>{products.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.name}</td>
                    <td>Rs {p.price}</td>
                    <td>{p.dealer_price ? `Rs ${p.dealer_price}` : '-'}</td>
                    <td>{p.distributor_price ? `Rs ${p.distributor_price}` : '-'}</td>
                    <td>{p.warranty_years || 5} years</td>
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
