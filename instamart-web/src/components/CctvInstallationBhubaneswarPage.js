import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';
import FaqSection from './FaqSection';

function CctvInstallationBhubaneswarPage() {
  const faqs = useMemo(() => ([
    {
      question: 'Does Camigo support CCTV installation in Bhubaneswar?',
      answer: 'Yes. Camigo supports CCTV installation workflows in Bhubaneswar for eligible orders, depending on product type, service coverage, and scheduling availability.'
    },
    {
      question: 'Can I buy products and installation together?',
      answer: 'Yes. Customers can buy cameras, recorders, switches, accessories, or setup packages first and then use Camigo’s installation support paths for eligible service areas.'
    },
    {
      question: 'What places can use CCTV installation support?',
      answer: 'Camigo’s installation support is suited for homes, offices, shops, apartments, warehouses, and other practical surveillance projects in and around Bhubaneswar.'
    }
  ]), []);

  usePageSeo({
    title: 'CCTV Installation in Bhubaneswar | Home, Office and Shop Setup | Camigo',
    description: 'Book or plan CCTV installation in Bhubaneswar with Camigo. Get support for home CCTV setup, office surveillance, shop camera installation, and complete recorder or accessories planning.',
    canonicalUrl: 'https://getcamigo.in/cctv-installation-bhubaneswar',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Service',
          serviceType: 'CCTV Installation in Bhubaneswar',
          provider: {
            '@type': 'Organization',
            name: 'Camigo',
            url: 'https://getcamigo.in/'
          },
          areaServed: ['Bhubaneswar', 'Patia', 'Khandagiri', 'Cuttack', 'Khordha'],
          url: 'https://getcamigo.in/cctv-installation-bhubaneswar'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'CCTV Installation in Bhubaneswar', item: 'https://getcamigo.in/cctv-installation-bhubaneswar' }
          ]
        },
        {
          '@type': 'FAQPage',
          mainEntity: faqs.map((item) => ({
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

  return (
    <main className="container policy-page">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>CCTV Installation in Bhubaneswar</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">Local Installation Support</span>
        <h1>CCTV installation support in Bhubaneswar for homes, shops, offices, and warehouses.</h1>
        <p>
          Camigo supports customers searching for CCTV installation in Bhubaneswar by helping them plan cameras,
          recorders, accessories, and setup packages together. This is useful for people who need both the product
          and the path to a working surveillance setup.
        </p>

        <section className="policy-section">
          <h2>Installation use cases</h2>
          <ul>
            <li>Home CCTV installation for entrances, parking, terraces, and common access points.</li>
            <li>Office and shop camera installation for counters, entry control, and asset monitoring.</li>
            <li>Apartment and warehouse surveillance planning with recorders, power, and networking accessories.</li>
            <li>Multi-camera setups using DVR, NVR, PoE switches, and bundled setup packages.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>What customers usually search for</h2>
          <p>
            This page is designed for searches like CCTV installation near me in Bhubaneswar, home CCTV installation
            Bhubaneswar, office CCTV installation, shop camera installation, and CCTV setup support in Odisha.
          </p>
        </section>

        <section className="policy-section">
          <h2>Useful next steps</h2>
          <p>
            Visit the <Link to="/install">installation booking page</Link>, explore
            <Link to="/shop"> CCTV products</Link>, or start with
            <Link to="/cctv-camera-bhubaneswar"> CCTV camera buying in Bhubaneswar</Link>.
          </p>
        </section>

        <FaqSection title="CCTV Installation Bhubaneswar FAQs" eyebrow="Before you book" items={faqs} />
      </div>
    </main>
  );
}

export default CctvInstallationBhubaneswarPage;
