import React from 'react';

function FaqSection({ title = 'Frequently Asked Questions', eyebrow = 'FAQs', items = [] }) {
  if (!items.length) return null;

  return (
    <section className="faq-section">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <div className="faq-grid">
        {items.map((item) => (
          <article key={item.question} className="faq-card">
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FaqSection;
