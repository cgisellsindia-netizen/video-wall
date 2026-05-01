import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Truck, X } from 'lucide-react';
import { API_URL } from '../api';
import { formatOrderStatusLabel, isPaymentPendingOrder } from '../orderTracking';
const DELIVERY_MS = 90000;

export function getDeliveryState(order) {
  if (!order?.id) return { step: 0, delivered: false, percent: 0 };
  if (isPaymentPendingOrder(order)) return { step: 0, delivered: false, percent: 0 };
  if (order.status === 'delivered') return { step: 4, delivered: true, percent: 100 };

  const statusPercent = {
    pending: 18,
    accepted: 30,
    arrived_at_store: 40,
    packed: 48,
    picked_up: 58,
    out_for_delivery: 76
  };

  if (order.status && statusPercent[order.status]) {
    const percent = statusPercent[order.status];
    const step = percent >= 72 ? 3 : percent >= 38 ? 2 : 1;
    return { step, delivered: false, percent };
  }

  const elapsed = Date.now() - Number(order.createdAt || Date.now());
  const percent = Math.min(88, Math.round((elapsed / DELIVERY_MS) * 100));
  const step = percent >= 72 ? 3 : percent >= 38 ? 2 : 1;
  return { step, delivered: false, percent };
}

function FloatingTracker({ activeOrder, onDismiss, onRate }) {
  const [rating, setRating] = useState(0);
  const [tracking, setTracking] = useState(null);
  const [routeEta, setRouteEta] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeOrder?.id) return undefined;
    let stopped = false;
    let poller;

    const loadTracking = async () => {
      if (stopped) return;
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/tracking/${activeOrder.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setTracking(data);
          if (data?.order?.status === 'delivered') {
            stopped = true;
            if (poller) clearInterval(poller);
          }
        }
      } catch (e) {}
    };

    loadTracking();
    poller = setInterval(loadTracking, 1000);
    return () => {
      stopped = true;
      clearInterval(poller);
    };
  }, [activeOrder?.id]);

  const order = useMemo(() => ({
    ...activeOrder,
    ...(tracking?.order || {})
  }), [activeOrder, tracking]);
  const partner = tracking?.partner_location;
  const partnerSummary = tracking?.partner || partner;

  useEffect(() => {
    const delivered = tracking?.order?.status === 'delivered';
    if (delivered) {
      setRouteEta(null);
      return undefined;
    }
    if (!partner?.lat || !partner?.lng) {
      setRouteEta(null);
      return undefined;
    }

    const controller = new AbortController();
    const lat = Number(partner.lat);
    const lng = Number(partner.lng);
    const customerLat = Number(order.customer_lat || activeOrder?.customer_lat || 20.3059);
    const customerLng = Number(order.customer_lng || activeOrder?.customer_lng || 85.8574);
    fetch(`https://router.project-osrm.org/route/v1/driving/${lng},${lat};${customerLng},${customerLat}?overview=false`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const route = data?.routes?.[0];
        if (route?.duration) {
          setRouteEta({
            durationMin: Math.max(1, Math.round(route.duration / 60)),
            distanceKm: route.distance / 1000
          });
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [partner?.lat, partner?.lng, tracking?.order?.status, order.customer_lat, order.customer_lng, activeOrder?.customer_lat, activeOrder?.customer_lng]);

  if (!activeOrder?.id) return null;
  if (order?.id && isPaymentPendingOrder(order)) return null;

  const state = getDeliveryState(order);
  const delivered = order.status === 'delivered' || state.delivered;
  const percent = state.percent;
  const eta = delivered ? 'Delivered' : `${routeEta?.durationMin || Math.max(3, Math.ceil((100 - percent) / 4))} min`;
  const partnerName = partnerSummary?.partner_name || partnerSummary?.name || 'Delivery partner';

  return (
    <section className="floating-status-bar">
      <button className="floating-close" onClick={onDismiss}><X size={16} /></button>
      <div className="floating-status-icon"><Truck size={20} /></div>
      <div className="floating-status-body" onClick={() => navigate(`/tracking/${activeOrder.id}`)}>
        <span>Order #{activeOrder.id}</span>
        <strong>{delivered ? 'Delivered' : formatOrderStatusLabel(order.status || 'out_for_delivery', order.payment_status)}</strong>
        <small>{delivered ? `Delivered by ${partnerName}. Rate your product and delivery` : partner ? `${partnerName} is live on route` : partnerSummary?.partner_name ? `${partnerName} assigned. Waiting for live GPS` : 'Waiting for partner live location'}</small>
        {!delivered && <div className="floating-progress"><i style={{ width: `${percent}%` }} /></div>}

        {delivered && (
          <div className="floating-rating" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map(value => (
              <button key={value} onClick={() => setRating(value)} className={value <= rating ? 'active' : ''}>
                <Star size={16} />
              </button>
            ))}
            <button className="rating-submit" onClick={() => onRate(rating || 5)}>Submit</button>
          </div>
        )}
      </div>
      <button className="floating-status-eta" onClick={() => navigate(`/tracking/${activeOrder.id}`)}>
        <strong>{eta.replace(' min', '')}</strong>
        <span>{eta.includes('min') ? 'min' : 'open'}</span>
      </button>
    </section>
  );
}

export default FloatingTracker;
