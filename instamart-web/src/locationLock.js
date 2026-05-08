const LOCATION_KEY = 'camigo_customer_location';
const LOCK_KEY = 'camigo_customer_location_lock';
const AREA_KEY = 'camigo_customer_area_name';
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
let googleMapsPlacesPromise = null;
const withTimeout = (promise, timeoutMs = 4000) => (
  Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs))
  ])
);
const expandLocationQueries = (term = '') => {
  const base = String(term || '').trim();
  const variants = [
    base,
    `${base}, Bhubaneswar, Odisha, India`,
    `${base}, Odisha, India`,
    `${base}, India`
  ].map((value) => value.trim()).filter(Boolean);
  return variants.filter((value, index) => variants.indexOf(value) === index);
};

const normalizePosition = (position, source, locked = false) => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  accuracy: position.coords.accuracy,
  altitudeAccuracy: position.coords.altitudeAccuracy,
  heading: position.coords.heading,
  speed: position.coords.speed,
  source,
  locked,
  savedAt: Date.now()
});

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch (e) {
    localStorage.removeItem(key);
    return null;
  }
};

export const getSavedCustomerLocation = () => readJson(LOCK_KEY) || readJson(LOCATION_KEY);

export const getSavedCustomerAreaName = () => localStorage.getItem(AREA_KEY) || '';

export const saveCustomerAreaName = (value = '') => {
  const areaName = String(value || '').trim();
  if (areaName) localStorage.setItem(AREA_KEY, areaName);
  return areaName;
};

export const saveCustomerLocation = (location, locked = false) => {
  const payload = { ...location, locked, savedAt: location.savedAt || Date.now() };
  localStorage.setItem(locked ? LOCK_KEY : LOCATION_KEY, JSON.stringify(payload));
  if (locked) localStorage.setItem(LOCATION_KEY, JSON.stringify(payload));
  return payload;
};

const getAreaParts = (address = {}) => {
  const locality = [
    address.suburb,
    address.neighbourhood,
    address.city_district,
    address.residential,
    address.quarter,
    address.hamlet,
    address.village,
    address.town,
    address.city
  ].filter(Boolean);
  const region = [
    address.city,
    address.county,
    address.state_district,
    address.state
  ].filter(Boolean);
  return {
    primary: locality[0] || region[0] || '',
    secondary: region.find((value) => value && value !== locality[0]) || ''
  };
};

const loadGoogleMapsPlaces = async () => {
  if (!GOOGLE_MAPS_API_KEY || typeof window === 'undefined') return null;
  if (window.google?.maps?.places && window.google?.maps?.Geocoder) return window.google.maps;
  if (googleMapsPlacesPromise) return googleMapsPlacesPromise;

  googleMapsPlacesPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-google-maps-places="true"]');
    if (existing) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      existing.addEventListener('load', () => resolve(window.google?.maps || null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      window.setTimeout(() => resolve(window.google?.maps || null), 3500);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = 'true';
    script.onload = () => resolve(window.google?.maps || null);
    script.onerror = () => resolve(null);
    window.setTimeout(() => resolve(window.google?.maps || null), 3500);
    document.head.appendChild(script);
  });

  return withTimeout(googleMapsPlacesPromise, 4000);
};

const geocodePlaceId = async (maps, placeId, fallbackLabel = '') => {
  if (!maps?.Geocoder || !placeId) return null;
  return new Promise((resolve) => {
    const geocoder = new maps.Geocoder();
    geocoder.geocode({ placeId }, (results, status) => {
      const okStatus = status === 'OK' || status === maps.GeocoderStatus?.OK;
      if (!okStatus || !Array.isArray(results) || !results[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const location = results[0].geometry.location;
      resolve({
        label: fallbackLabel || results[0].formatted_address,
        lat: typeof location.lat === 'function' ? location.lat() : location.lat,
        lng: typeof location.lng === 'function' ? location.lng() : location.lng
      });
    });
  });
};

export const resolveCustomerAreaName = async ({ lat, lng } = {}) => {
  if (!lat || !lng) return getSavedCustomerAreaName();
  try {
    let areaName = '';
    if (GOOGLE_MAPS_API_KEY) {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`);
      if (response.ok) {
        const data = await response.json();
        const components = Array.isArray(data?.results?.[0]?.address_components) ? data.results[0].address_components : [];
        const pick = (...types) => (
          components.find((component) => types.every((type) => component.types.includes(type)))?.long_name || ''
        );
        const primary = pick('sublocality_level_1', 'sublocality') || pick('locality', 'political') || pick('neighborhood', 'political') || pick('administrative_area_level_2', 'political');
        const secondary = pick('locality', 'political') || pick('administrative_area_level_2', 'political') || pick('administrative_area_level_1', 'political');
        areaName = [primary, secondary].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(', ');
        if (!areaName) areaName = data?.results?.[0]?.formatted_address || '';
      }
    }
    if (!areaName) {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en'
        }
      });
      if (!response.ok) throw new Error('Reverse geocode failed');
      const data = await response.json();
      const parts = getAreaParts(data?.address || {});
      areaName = [parts.primary, parts.secondary].filter(Boolean).join(', ') || data?.display_name || '';
    }
    areaName = areaName || getSavedCustomerAreaName() || 'Bhubaneswar, Odisha';
    localStorage.setItem(AREA_KEY, areaName);
    return areaName;
  } catch (error) {
    return getSavedCustomerAreaName() || 'Bhubaneswar, Odisha';
  }
};

export const captureCustomerLocation = ({ lock = false, timeout = 10000, maximumAge = 0, source = 'auto' } = {}) => (
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(saveCustomerLocation(normalizePosition(position, source, lock), lock)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge }
    );
  })
);

export const searchCustomerLocations = async (query = '') => {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const expandedQueries = expandLocationQueries(term);

  if (GOOGLE_MAPS_API_KEY) {
    try {
      const maps = await loadGoogleMapsPlaces();
      if (maps?.places?.AutocompleteService) {
        const autocompleteService = new maps.places.AutocompleteService();
        for (const expandedQuery of expandedQueries) {
          const predictions = await withTimeout(new Promise((resolve) => {
            autocompleteService.getPlacePredictions(
              {
                input: expandedQuery,
                componentRestrictions: { country: 'in' }
              },
              (results, status) => {
                const okStatus = status === 'OK' || status === maps.places.PlacesServiceStatus?.OK;
                resolve(okStatus && Array.isArray(results) ? results : []);
              }
            );
          }), 3000);
          if (!predictions.length) continue;
          const placeResults = (await Promise.all(
            predictions.slice(0, 6).map((prediction) => (
              geocodePlaceId(maps, prediction.place_id, prediction.description)
            ))
          )).filter((item) => item?.label && Number.isFinite(item?.lat) && Number.isFinite(item?.lng));
          if (placeResults.length > 0) return placeResults;
        }
      }

      for (const expandedQuery of expandedQueries) {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(expandedQuery)}&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`);
        if (!response.ok) continue;
        const data = await response.json();
        const googleResults = (Array.isArray(data?.results) ? data.results : []).slice(0, 5).map((result) => ({
          label: result.formatted_address,
          lat: result.geometry?.location?.lat,
          lng: result.geometry?.location?.lng
        })).filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng));
        if (googleResults.length > 0 && data?.status === 'OK') return googleResults;
      }
    } catch (error) {
      // Fall through to OSM if Google Places/Geocoding fails in the browser.
    }
  }

  try {
    for (const expandedQuery of expandedQueries) {
      const fallbackResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(expandedQuery)}`, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en'
        }
      });
      if (!fallbackResponse.ok) continue;
      const data = await fallbackResponse.json();
      const fallbackResults = (Array.isArray(data) ? data : []).map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon)
      })).filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng));
      if (fallbackResults.length > 0) return fallbackResults;
    }
    return [];
  } catch (error) {
    return [];
  }
};
