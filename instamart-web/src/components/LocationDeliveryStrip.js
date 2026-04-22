import React, { useEffect, useState } from 'react';
import { MapPin, Navigation, Zap } from 'lucide-react';

function LocationDeliveryStrip() {
  const [location, setLocation] = useState(localStorage.getItem('camigo_location') || 'Bhubaneswar');
  const [status, setStatus] = useState('Fast delivery zone active');

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Location not supported. Serving Bhubaneswar');
      return;
    }
    setStatus('Detecting your delivery location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const value = `Near ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`;
        localStorage.setItem('camigo_location', value);
        setLocation(value);
        setStatus('Location locked. Same-day dispatch available');
      },
      () => setStatus('Permission blocked. Showing Bhubaneswar delivery zone'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!localStorage.getItem('camigo_location')) detectLocation();
  }, []);

  return (
    <section className="delivery-strip">
      <div>
        <span className="eyebrow">Delivery in 26 mins</span>
        <h2><MapPin size={22} /> {location}</h2>
        <p>{status}</p>
      </div>
      <button onClick={detectLocation}><Navigation size={16} /> Auto fetch location</button>
      <div className="delivery-strip-badge"><Zap size={16} /> Same-day CCTV delivery + install support</div>
    </section>
  );
}

export default LocationDeliveryStrip;
