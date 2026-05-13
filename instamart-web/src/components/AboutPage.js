import React from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';

function AboutPage() {
  usePageSeo({
    title: 'About Camigo | CCTV Dealer and Installation Support in Bhubaneswar',
    description: 'Learn about Camigo, our CCTV product catalog, CCTV camera supply, installation support in Bhubaneswar, and how we help homes, offices, shops, warehouses, and installers across Odisha.',
    canonicalUrl: 'https://getcamigo.in/about-camigo',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'AboutPage',
          name: 'About Camigo',
          url: 'https://getcamigo.in/about-camigo',
          description: 'About Camigo CCTV delivery, CCTV camera dealer services, installation, and support in Bhubaneswar and Odisha.'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'About Camigo', item: 'https://getcamigo.in/about-camigo' }
          ]
        },
        {
          '@type': 'Organization',
          name: 'Camigo',
          url: 'https://getcamigo.in/',
          email: 'cgisellsindia@gmail.com',
          telephone: '+91 9114 555 044',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Swarnapuri Rd, Bajrang Vihar, Patia',
            addressLocality: 'Bhubaneswar',
            addressRegion: 'Odisha',
            postalCode: '751024',
            addressCountry: 'IN'
          }
        }
      ]
    }
  });

  return (
    <main className="container policy-page">
      <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>About Camigo</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">About Camigo</span>
        <h1>Fast CCTV delivery, installation support, and project-ready product sourcing.</h1>
        <p>
          Camigo helps homes, retail stores, offices, warehouses, and installers source CCTV cameras,
          recorders, PoE switches, power supplies, accessories, and bundled setup packages with quick dispatch
          and support from Bhubaneswar.
        </p>

        <section className="policy-section">
          <h2>Local CCTV search coverage</h2>
          <p>
            Camigo is built to serve customers searching for CCTV camera dealers in Bhubaneswar, CCTV installation
            in Bhubaneswar, security camera installation in Odisha, IP camera suppliers, PTZ camera dealers,
            dome camera and bullet camera sellers, and DVR or NVR setup support for homes and businesses.
          </p>
        </section>

        <section className="policy-section">
          <h2>What Camigo provides</h2>
          <ul>
            <li>CCTV product discovery across AHD cameras, IP cameras, PTZ cameras, DVRs, NVRs, switches, SMPS units, and accessories.</li>
            <li>Setup package options for common installation needs so customers can buy faster with fewer mismatched parts.</li>
            <li>Installation support for homes, shops, offices, and project-based surveillance requirements.</li>
            <li>Dealer and distributor-friendly pricing support for trade buyers and repeat installation work.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>How we work</h2>
          <p>
            Camigo is built around practical CCTV buying. Customers can compare products, choose setup packages,
            order online, and use local support paths for installation or follow-up. Our goal is to reduce buying
            confusion and make the product-to-installation journey simpler.
          </p>
        </section>

        <section className="policy-section">
          <h2>Business contact</h2>
          <p>Email: cgisellsindia@gmail.com</p>
          <p>Phone: +91 9114 555 044</p>
          <p>Address: Swarnapuri Rd, Bajrang Vihar, Patia, Bhubaneswar, Odisha 751024</p>
        </section>
      </div>
    </main>
  );
}

export default AboutPage;
