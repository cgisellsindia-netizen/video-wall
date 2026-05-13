import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, Calendar, Clock, MapPin, Phone, CheckCircle } from 'lucide-react';
import usePageSeo from '../usePageSeo';
import FaqSection from './FaqSection';

function InstallationPage({ user, onLogin }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone_verified ? user?.phone || '' : '',
    address: user?.address || '',
    date: '',
    time: '',
    cameraCount: '4',
    propertyType: 'home',
    notes: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const installationFaqs = useMemo(() => ([
    {
      question: 'How do I book CCTV installation through Camigo?',
      answer: 'You can book installation by logging in, filling the installation form, selecting a preferred date and time, and submitting your contact and site details.'
    },
    {
      question: 'Does Camigo provide same-day CCTV installation?',
      answer: 'Same-day installation may be available for eligible orders and locations when booking happens early enough and service capacity is available.'
    },
    {
      question: 'What information should I provide before installation?',
      answer: 'Customers should provide site address, preferred date and time, number of cameras, property type, and any setup notes that affect installation planning.'
    }
  ]), []);

  usePageSeo({
    title: 'Book CCTV Installation | Camigo',
    description: 'Book CCTV installation with Camigo for homes, offices, shops, and project sites, with setup support and service coordination.',
    canonicalUrl: 'https://getcamigo.in/install',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          serviceType: 'CCTV Installation Booking',
          provider: {
            '@type': 'Organization',
            name: 'Camigo',
            url: 'https://getcamigo.in/'
          },
          areaServed: 'Bhubaneswar',
          url: 'https://getcamigo.in/install'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'Installation', item: 'https://getcamigo.in/install' }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: installationFaqs.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer
            }
          }))
        }
      ]
    }
  });

  if (!user) { onLogin(); return null; }

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '60px 16px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <CheckCircle size={64} style={{ color: '#1ba672', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '8px' }}>Booking Confirmed!</h2>
          <p style={{ color: '#64748b', marginBottom: '8px' }}>Our technician will visit your location on {form.date} at {form.time}.</p>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>Contact: +91 9114 555 044 for any changes.</p>
          <button className="btn btn-primary" onClick={() => navigate('/shop')}>Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '24px 16px 100px' }}>
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Installation</span>
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Wrench size={28} color="#f6c400" />
        <h2 className="section-title" style={{ margin: 0 }}>Book CCTV Installation</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        <form onSubmit={handleSubmit}>
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Contact Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group"><label>Full Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
            </div>
            <div className="form-group" style={{ marginTop: '12px' }}><label>Address</label><textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} rows="2" required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Installation Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group"><label><Calendar size={14} style={{ marginRight: '4px' }} />Preferred Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
              <div className="form-group"><label><Clock size={14} style={{ marginRight: '4px' }} />Preferred Time</label>
                <select value={form.time} onChange={e => setForm({...form, time: e.target.value})} required style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }}>
                  <option value="">Select time</option>
                  <option value="9:00 AM - 12:00 PM">Morning (9 AM - 12 PM)</option>
                  <option value="12:00 PM - 3:00 PM">Afternoon (12 PM - 3 PM)</option>
                  <option value="3:00 PM - 6:00 PM">Evening (3 PM - 6 PM)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div className="form-group"><label>Number of Cameras</label>
                <select value={form.cameraCount} onChange={e => setForm({...form, cameraCount: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }}>
                  <option value="2">2 Cameras</option>
                  <option value="4">4 Cameras</option>
                  <option value="8">8 Cameras</option>
                  <option value="16">16 Cameras</option>
                  <option value="32+">32+ Cameras (Project)</option>
                </select>
              </div>
              <div className="form-group"><label>Property Type</label>
                <select value={form.propertyType} onChange={e => setForm({...form, propertyType: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }}>
                  <option value="home">Home / Apartment</option>
                  <option value="shop">Shop / Showroom</option>
                  <option value="office">Office / Commercial</option>
                  <option value="warehouse">Warehouse / Factory</option>
                  <option value="project">Construction Project</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '12px' }}><label>Additional Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows="2" placeholder="Any specific requirements..." style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #dbe3ef' }} /></div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }}>
            <Wrench size={18} style={{ marginRight: '8px' }} /> Book Installation
          </button>
        </form>

        <div>
          <div className="card" style={{ position: 'sticky', top: '100px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Why Camigo?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f6c40020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Clock size={16} color="#f6c400" /></div>
                <div><div style={{ fontWeight: 700, fontSize: '14px' }}>Same Day Service</div><div style={{ fontSize: '13px', color: '#64748b' }}>Book before 2 PM for same-day installation</div></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f6c40020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MapPin size={16} color="#f6c400" /></div>
                <div><div style={{ fontWeight: 700, fontSize: '14px' }}>Bhubaneswar Coverage</div><div style={{ fontSize: '13px', color: '#64748b' }}>All areas including Patia, Khandagiri, Cuttack</div></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f6c40020', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Phone size={16} color="#f6c400" /></div>
                <div><div style={{ fontWeight: 700, fontSize: '14px' }}>24/7 Support</div><div style={{ fontSize: '13px', color: '#64748b' }}>Call +91 9114 555 044 anytime</div></div>
              </div>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #dbe3ef', fontSize: '13px', color: '#64748b' }}>
              Installation charges: Rs 500 per camera (standard setup). Project quotes available on request.
            </div>
          </div>
        </div>
      </div>
      <FaqSection title="Installation FAQs" eyebrow="Before you book" items={installationFaqs} />
    </div>
  );
}

export default InstallationPage;
