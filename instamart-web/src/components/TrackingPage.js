import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, MapPin, PackageCheck, Phone, PlusCircle, Star, Truck } from 'lucide-react';
import { getDeliveryState } from './FloatingTracker';
import RoadRouteMap from './RoadRouteMap';
import { API_URL } from '../api';
import { formatOrderStatusLabel, isPaymentPendingOrder } from '../orderTracking';

function TrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [partnerLocation, setPartnerLocation] = useState(null);
  const [partnerSummary, setPartnerSummary] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const activeOrder = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('camigo_active_order') || 'null');
      if (String(saved?.id) === String(id)) return saved;
    } catch (e) {}
    return { id, createdAt: Date.now() - 15000, address: order?.address };
  }, [id, order]);

  const delivery = getDeliveryState({ ...activeOrder, status: order?.status });

  useEffect(() => {
    let stopped = false;
    let poller;

    const loadTracking = () => {
      if (stopped) return;
      const token = localStorage.getItem('token');
      fetch(`${API_URL}/tracking/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return;
          setOrder(data.order || null);
          setPartnerLocation(data.partner_location || null);
          setPartnerSummary(data.partner || data.partner_location || null);
          if (data.order?.status === 'delivered') {
            stopped = true;
            if (poller) clearInterval(poller);
          }
        })
        .catch(() => setOrder(null));
    };
    loadTracking();
    poller = setInterval(loadTracking, 1000);
    return () => {
      stopped = true;
      clearInterval(poller);
    };
  }, [id]);

  const steps = [
    { title: 'Order confirmed', icon: CheckCircle2 },
    { title: 'Packed at Camigo hub', icon: PackageCheck },
    { title: 'Out for delivery', icon: Truck },
    { title: 'Delivered', icon: MapPin }
  ];

  const delivered = order?.status === 'delivered' || delivery.delivered;
  const paymentIncomplete = !delivered && isPaymentPendingOrder(order);
  const etaMinutes = delivered ? 0 : routeInfo?.durationMin || (partnerLocation ? 23 : Math.max(1, Math.ceil((100 - delivery.percent) / 18)));
  const customerLocation = order?.customer_lat && order?.customer_lng
    ? { lat: Number(order.customer_lat), lng: Number(order.customer_lng) }
    : null;
  const routeDestination = ['pending', 'accepted', 'arrived_at_store', 'packed'].includes(order?.status)
    ? 'hub'
    : 'customer';
  const visiblePartnerLocation = delivered ? null : partnerLocation;
  const partnerName = partnerSummary?.partner_name || partnerLocation?.partner_name || order?.delivery_partner_name || 'Delivery partner';
  const externalTrackingUrl = partnerSummary?.tracking_url || order?.uber_tracking_url || null;

  const submitRating = () => {
    setSubmitted(true);
    localStorage.removeItem('camigo_active_order');
  };

  const callPartner = (event) => {
    event.stopPropagation();
    const phone = partnerLocation?.partner_phone || partnerSummary?.partner_phone || order?.delivery_partner_phone;
    if (phone) window.location.href = `tel:${phone}`;
  };

  if (paymentIncomplete) {
    return (
      <main className="tracking-page live-tracking-page">
        <section className="tracking-card live-tracking-card">
          <div className="tracking-title-row">
            <div>
              <span className="eyebrow">Order status</span>
              <h1>Payment not completed</h1>
              <p>Order #{id} is not dispatched because online payment did not finish successfully.</p>
            </div>
            <div className="tracking-big-eta">
              <strong>0</strong>
              <span>min</span>
            </div>
          </div>

          <div className="tracking-bottom-sheet">
            <div className="sheet-main-row">
              <div>
                <h2>{formatOrderStatusLabel(order)}</h2>
                <p>This order cannot enter live delivery tracking until payment is completed.</p>
              </div>
              <div className="tracking-sheet-eta">
                <strong>Hold</strong>
                <span>state</span>
              </div>
            </div>

            <div className="live-location-panel">
              <Truck size={18} />
              <div>
                <strong>No delivery partner assigned yet</strong>
                <span>This order is waiting for payment confirmation. Cancel it from Orders and place checkout again after payment.</span>
              </div>
            </div>

            <div className="tracking-steps">
              {steps.map((item, index) => {
                const Icon = item.icon;
                const active = index === 0;
                return (
                  <div key={item.title} className={active ? 'tracking-step active' : 'tracking-step'}>
                    <Icon size={20} />
                    <span>{item.title}</span>
                  </div>
                );
              })}
            </div>

            <div className="tracking-delay-coupon">
              <Truck size={18} />
              <div>
                <span>PAYMENT REQUIRED</span>
                <strong>Go back to Orders, cancel this unpaid order, and place checkout again.</strong>
              </div>
            </div>

            <div className="checkout-actions" style={{ marginTop: '18px' }}>
              <button className="checkout-pay-btn secondary" onClick={() => navigate('/orders')}>Back to Orders</button>
              <button className="checkout-pay-btn" onClick={() => navigate('/')}>Browse Products</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="tracking-page live-tracking-page">
      <section className="tracking-card live-tracking-card">
        <div className="tracking-title-row">
          <div>
            <span className="eyebrow">Live tracking</span>
            <h1>Order #{id}</h1>
            <p>{order ? `Delivering to ${order.address}` : 'Loading order route...'}</p>
          </div>
          <div className="tracking-big-eta">
            <strong>{delivered ? '0' : etaMinutes}</strong>
            <span>{delivered ? 'done' : 'min'}</span>
          </div>
        </div>

        {order?.delivery_otp && !delivered && (
          <div className="customer-otp-card">
            <span>Share this OTP only when the partner reaches you</span>
            <strong>{order.delivery_otp}</strong>
          </div>
        )}

        <div className="real-map live-route-map">
          {!delivered ? (
            <RoadRouteMap partnerLocation={visiblePartnerLocation} customerLocation={customerLocation} destination={routeDestination} onRoute={setRouteInfo} />
          ) : (
            <div className="delivered-map-placeholder">
              <CheckCircle2 size={42} />
              <strong>Order delivered</strong>
              <span>Live partner location is closed for this order.</span>
            </div>
          )}
          <div className="route-map-chip">
            <strong>{delivered ? 'Delivered' : routeInfo ? `${routeInfo.durationMin} min` : 'Route loading'}</strong>
            <span>{delivered ? 'Live GPS is no longer requested after delivery' : routeInfo ? `${routeInfo.distanceKm.toFixed(1)} km by road to ${routeDestination === 'hub' ? 'hub' : 'delivery address'}` : customerLocation ? 'Finding real road route' : 'Customer GPS not saved for this order'}</span>
          </div>
        </div>

        <div className="tracking-bottom-sheet">
          <div className="sheet-main-row">
            <div>
              <h2>{delivered ? 'Delivered' : formatOrderStatusLabel(order?.status || 'out_for_delivery', order?.payment_status)}</h2>
              <p>{delivered ? `${partnerName} completed this delivery` : partnerLocation ? `${partnerName} is on the way to deliver your order` : partnerSummary ? `${partnerName} is assigned. Waiting for live GPS` : 'Waiting for delivery partner live location'}</p>
            </div>
            <div className="tracking-sheet-eta">
              <strong>{delivered ? '0' : etaMinutes}</strong>
              <span>{delivered ? 'done' : 'min'}</span>
            </div>
          </div>

          <div className={!delivered && partnerLocation ? 'live-location-panel active' : 'live-location-panel'}>
            <Truck size={18} />
            <div>
              <strong>{delivered ? 'Delivery completed' : partnerLocation ? `${partnerName} location active` : 'No live GPS yet'}</strong>
              <span>{delivered ? 'Tracking stopped after delivery.' : partnerLocation ? `Route to ${routeDestination === 'hub' ? 'Camigo hub' : 'delivery address'} - ${routeInfo ? `${routeInfo.distanceKm.toFixed(1)} km, ${routeInfo.durationMin} min` : 'calculating'} - ${partnerLocation.updated_at}` : 'Ask delivery partner to tap Go online.'}</span>
            </div>
            <button className="partner-call-btn" onClick={callPartner} disabled={!(partnerLocation?.partner_phone || partnerSummary?.partner_phone || order?.delivery_partner_phone)}><Phone size={16} /></button>
          </div>

          {externalTrackingUrl && !delivered && (
            <div className="tracking-instruction-row">
              <Truck size={20} />
              <div>
                <strong>Open Uber tracking</strong>
                <span>Use the live Uber Direct tracking page for courier-side updates.</span>
              </div>
              <button className="partner-call-btn" onClick={() => window.open(externalTrackingUrl, '_blank', 'noopener,noreferrer')}>
                Open
              </button>
            </div>
          )}

          <div className="tracking-instruction-row">
            <PlusCircle size={20} />
            <div>
              <strong>Add Delivery Instructions</strong>
              <span>First house on the left at the entry gate</span>
            </div>
          </div>

          <div className="tracking-steps">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = delivered
                || index < delivery.step
                || (['accepted', 'packed', 'arrived_at_store', 'picked_up'].includes(order?.status) && index < 2)
                || (order?.status === 'out_for_delivery' && index < 3);
              return (
                <div key={item.title} className={active ? 'tracking-step active' : 'tracking-step'}>
                  <Icon size={20} />
                  <span>{item.title}</span>
                </div>
              );
            })}
          </div>

          {!delivered && (
            <div className="tracking-delay-coupon">
              <Truck size={18} />
              <div>
                <span>SORRY, WE ARE DELAYED</span>
                <strong>Get Rs 25 coupon after order delivery</strong>
              </div>
            </div>
          )}
        </div>

        {delivered && (
          <div className="rating-card">
            <h3>How was your delivery?</h3>
            <p>Rate product quality and delivery experience.</p>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map(value => (
                <button key={value} onClick={() => setRating(value)} className={value <= rating ? 'active' : ''}>
                  <Star size={24} />
                </button>
              ))}
            </div>
            <button className="checkout-pay-btn" onClick={submitRating}>{submitted ? 'Thanks for rating' : 'Submit rating'}</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default TrackingPage;
