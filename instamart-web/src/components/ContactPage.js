import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

function ContactPage({ user }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone_verified ? user?.phone || '' : '',
    subject: 'bulk-order',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '60px 16px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <CheckCircle size={64} style={{ color: '#1ba672', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '8px' }}>Message Sent!</h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>Our team will contact you within 24 hours.</p>
          <button className="btn btn-primary" onClick={() => navigate('/shop')}>Back to Shop</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '900px', padding: '24px 16px 100px' }}>
      <h2 className="section-title" style={{ marginBottom: '24px' }}>Contact Camigo</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Send us a Message</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
            </div>
            <div className="form-group" style={{ marginTop: '12px' }}><label>Phone</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
            <div className="form-group" style={{ marginTop: '12px' }}><label>Subject</label>
              <select value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }}>
                <option value="bulk-order">Bulk Order / Project Quote</option>
                <option value="installation">Installation Service</option>
                <option value="dealer">Become a Dealer</option>
                <option value="support">Technical Support</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ marginTop: '12px' }}><label>Message</label><textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} rows="4" placeholder="Tell us about your requirements..." required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px', padding: '14px' }}>
              <Send size={16} style={{ marginRight: '8px' }} /> Send Message
            </button>
          </div>
        </form>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Get in Touch</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Phone size={18} color="#f6c400" />
                <div><div style={{ fontWeight: 700, fontSize: '14px' }}>+91 9114 555 044</div><div style={{ fontSize: '12px', color: '#64748b' }}>Sales & Support</div></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Mail size={18} color="#f6c400" />
                <div><div style={{ fontWeight: 700, fontSize: '14px' }}>cgisellsindia@gmail.com</div><div style={{ fontSize: '12px', color: '#64748b' }}>Email us anytime</div></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <MapPin size={18} color="#f6c400" style={{ marginTop: '2px' }} />
                <div><div style={{ fontWeight: 700, fontSize: '14px' }}>Head Office</div><div style={{ fontSize: '12px', color: '#64748b' }}>Swarnapuri Rd, Bajrang Vihar, Patia, Bhubaneswar, Odisha 751024</div></div>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>Business Hours</h3>
            <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.8 }}>
              <div>Monday - Saturday: 9:00 AM - 8:00 PM</div>
              <div>Sunday: 10:00 AM - 6:00 PM</div>
              <div style={{ marginTop: '8px', fontWeight: 600, color: '#082a63' }}>24/7 Support for Dealers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
