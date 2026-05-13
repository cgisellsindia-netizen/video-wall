import React from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryBannerCarousel from './CategoryBannerCarousel';
import ProductImage from './ProductImage';

const categoryImages = {
  'Night Color AHD Cameras': '/category-real/ahd-cameras.jpg',
  'AHD Cameras': '/category-real/ahd-cameras.jpg',
  'IP Cameras': '/category-real/ip-cameras.jpg',
  'PTZ Cameras': '/category-real/ptz-cameras.jpg',
  'DVR Recorders': '/category-real/dvr-recorders.jpg',
  'DVR': '/category-real/dvr-recorders.jpg',
  'NVR Recorders': '/category-real/nvr-recorders.jpg',
  'NVR': '/category-real/nvr-recorders.jpg',
  'PoE Switches': '/category-real/poe-switches.jpg',
  'SMPS Power Supplies': '/category-real/smps-power.jpg',
  'Accessories': '/category-real/accessories.jpg',
};

function CategoryGrid({ categories, title = 'Shop by Category' }) {
  const navigate = useNavigate();

  return (
    <div className="category-section home-band home-band-categories">
      <CategoryBannerCarousel placementId={0} showEmptySlot />
      <div className="section-header"><h2 className="section-title">{title}</h2><span className="see-all">See all</span></div>
      <div className="category-grid">
        {categories.map(cat => (
          <div key={cat.id} className="category-card" onClick={() => navigate(`/category/${cat.id}`)}>
            <div className="category-img">
              <ProductImage
                src={cat.image || categoryImages[cat.name]}
                fallbackSrc={cat.image ? '' : '/category-real/accessories.jpg'}
                alt={cat.name}
                loading="lazy"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default CategoryGrid;
