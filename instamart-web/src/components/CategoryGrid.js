import React from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryBannerCarousel from './CategoryBannerCarousel';

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

function CategoryGrid({ categories }) {
  const navigate = useNavigate();

  return (
    <div className="category-section">
      <CategoryBannerCarousel placementId={0} />
      <div className="section-header"><h2 className="section-title">Shop by Category</h2><span className="see-all">See all</span></div>
      <div className="category-grid">
        {categories.map(cat => (
          <div key={cat.id} className="category-card" onClick={() => navigate(`/category/${cat.id}`)}>
            <div className="category-img">
              <img src={categoryImages[cat.name] || '/category-real/accessories.jpg'} alt={cat.name} />
            </div>
            <div className="category-name">{cat.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
export default CategoryGrid;
