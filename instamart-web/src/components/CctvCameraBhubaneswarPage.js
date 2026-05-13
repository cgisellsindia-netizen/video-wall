import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePageSeo from '../usePageSeo';
import FaqSection from './FaqSection';

function CctvCameraBhubaneswarPage() {
  const faqs = useMemo(() => ([
    {
      question: 'Can I buy CCTV cameras in Bhubaneswar directly from Camigo?',
      answer: 'Yes. Camigo helps Bhubaneswar customers buy CCTV cameras, DVRs, NVRs, accessories, and setup packages online with local delivery and support.'
    },
    {
      question: 'What types of CCTV cameras are available in Bhubaneswar?',
      answer: 'Camigo offers IP cameras, dome cameras, bullet cameras, PTZ cameras, DVRs, NVRs, PoE switches, SMPS units, and CCTV accessories for homes, offices, and shops.'
    },
    {
      question: 'Does Camigo support local CCTV delivery in Bhubaneswar?',
      answer: 'Yes. Eligible Bhubaneswar locations can see fast local dispatch estimates, while other Odisha destinations may be served by courier based on zone and product availability.'
    }
  ]), []);

  usePageSeo({
    title: 'CCTV Camera in Bhubaneswar | IP, Dome, Bullet and PTZ Cameras | Camigo',
    description: 'Buy CCTV cameras in Bhubaneswar from Camigo. Shop IP cameras, dome cameras, bullet cameras, PTZ cameras, DVRs, NVRs, PoE switches, and CCTV setup packages with local support.',
    canonicalUrl: 'https://getcamigo.in/cctv-camera-bhubaneswar',
    image: 'https://getcamigo.in/camigo-logo.svg',
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          name: 'CCTV Camera in Bhubaneswar',
          url: 'https://getcamigo.in/cctv-camera-bhubaneswar',
          description: 'Landing page for CCTV camera buyers in Bhubaneswar.'
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://getcamigo.in/' },
            { '@type': 'ListItem', position: 2, name: 'CCTV Camera in Bhubaneswar', item: 'https://getcamigo.in/cctv-camera-bhubaneswar' }
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
        <span>CCTV Camera in Bhubaneswar</span>
      </nav>
      <div className="policy-card">
        <span className="eyebrow">Local CCTV Shopping</span>
        <h1>CCTV camera dealer and online CCTV buying support in Bhubaneswar.</h1>
        <p>
          Camigo helps customers looking for CCTV cameras in Bhubaneswar compare products, choose setup packages,
          and buy surveillance gear for homes, shops, offices, apartments, and warehouses. Whether you need a simple
          home camera setup or a multi-camera office system, the catalog includes practical options for local buyers.
        </p>

        <section className="policy-section">
          <h2>Popular CCTV products in Bhubaneswar</h2>
          <ul>
            <li>IP cameras for sharper image quality and PoE-enabled setups.</li>
            <li>Dome cameras for indoor homes, offices, and ceiling-mount surveillance needs.</li>
            <li>Bullet cameras for gates, perimeters, shops, and outdoor monitoring.</li>
            <li>PTZ cameras for wide-area monitoring, zoom, and remote control.</li>
            <li>DVRs, NVRs, PoE switches, SMPS units, and CCTV accessories for complete setups.</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Who this page is for</h2>
          <p>
            This page is useful for people searching online for CCTV camera dealers in Bhubaneswar, CCTV camera shops,
            home CCTV camera setups, office surveillance systems, and CCTV accessories with local dispatch and support.
          </p>
        </section>

        <section className="policy-section">
          <h2>Useful next steps</h2>
          <p>
            Start by browsing the <Link to="/shop">full Camigo catalog</Link>, explore
            <Link to="/category/2"> IP cameras</Link>, or visit
            <Link to="/cctv-installation-bhubaneswar"> CCTV installation in Bhubaneswar</Link> if you also need setup support.
          </p>
        </section>

        <FaqSection title="CCTV Camera Bhubaneswar FAQs" eyebrow="Common questions" items={faqs} />
      </div>
    </main>
  );
}

export default CctvCameraBhubaneswarPage;
