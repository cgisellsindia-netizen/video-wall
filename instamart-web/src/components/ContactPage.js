import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';
import usePageSeo from '../usePageSeo';
import FaqSection from './FaqSection';

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
  const contactFaqs = useMemo(() => ([
    {
      question: 'How can I contact Camigo for CCTV support?',
      answer: 'You can contact Camigo through the website contact form, call +91 9114 555 044, or email cgisellsindia@gmail.com for product, dealer, or support queries.'
    },
    {
      question: 'Does Camigo handle bulk or project orders?',
      answer: 'Yes. Camigo supports bulk-order and project enquiries for homes, shops, offices, and larger surveillance requirements.'
    },
    {
      question: 'How fast does Camigo respond to enquiries?',
      answer: 'Camigo aims to respond to contact requests within 24 business hours, depending on the type of request and business hours.'
    }
  ]), []);

  usePageSeo({
    title: 'Contact Camigo | CCTV Sales and Support',
    description: 'Contact Camigo for CCTV product support, installation enquiries, dealer questions, and project-based surveillance requirements.',
    canonicalUrl: 'https://getcamigo.in/contact',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ContactPage',
          name: 'Contact Camigo',
          url: 'https://getcamigo.in/contact',
          description: 'Contact page for Camigo CCTV sales and support.'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://getcamigo.in/contact' }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: contactFaqs.map((item) => ({
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const subjectLabelMap = {
      'bulk-order': 'Bulk Order / Project Quote',
      installation: 'Installation Service',
      dealer: 'Become a Dealer',
      support: 'Technical Support',
      other: 'Other'
    };
    const emailSubject = `Camigo enquiry: ${subjectLabelMap[form.subject] || 'Website enquiry'}`;
    const emailBody = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Subject: ${subjectLabelMap[form.subject] || form.subject}`,
      '',
      'Message:',
      form.message
    ].join('\n');
    window.location.href = `mailto:cgisellsindia@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '60px 16px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <CheckCircle size={64} style={{ color: '#1ba672', marginBottom: '16px' }} />
          <h2 style={{ marginBottom: '8px' }}>Message Sent!</h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            Your email app should open with your enquiry ready to send. You can also call or WhatsApp us directly at +91 9114 555 044.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/shop')}>Back to Shop</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '900px', padding: '24px 16px 100px' }}>
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Contact</span>
      </nav>
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
              <Send size={16} style={{ marginRight: '8px' }} /> Send via Email App
            </button>
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#64748b' }}>
              This opens your email app with the enquiry filled in so you can send it directly to Camigo.
            </p>
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
      <FaqSection title="Contact and Support FAQs" eyebrow="Need help?" items={contactFaqs} />
    </div>
  );
}

export default ContactPage;
