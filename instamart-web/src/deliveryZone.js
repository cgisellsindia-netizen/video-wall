export const isLocalServiceZone = (lat, lng) => {
  const valueLat = Number(lat);
  const valueLng = Number(lng);
  if (!Number.isFinite(valueLat) || !Number.isFinite(valueLng)) return false;

  // Covers the Bhubaneswar, Khordha, and Cuttack delivery corridor.
  return valueLat >= 20.05 && valueLat <= 20.65 && valueLng >= 85.50 && valueLng <= 86.10;
};

export const extractPincode = (value = '') => {
  const match = String(value).match(/\b([1-9]\d{5})\b/);
  return match ? match[1] : '';
};

export const isValidIndianPincode = (pincode = '') => {
  const pin = String(pincode || '').trim();
  return /^[1-9]\d{5}$/.test(pin);
};

export const isServiceablePincode = (pincode = '') => {
  const pin = String(pincode || '').trim();
  if (!isValidIndianPincode(pin)) return false;
  // Camigo local service corridor: Bhubaneswar (751), Khordha/Jatni belt (7520xx/7521xx), and Cuttack (753).
  return pin.startsWith('751') || pin.startsWith('753') || /^752[01]\d{2}$/.test(pin);
};

export const isLocalAddressText = (address = '') => {
  const text = String(address).toLowerCase();
  return ['bhubaneswar', 'bbsr', 'cuttack', 'khordha', 'khurda', 'jatni', 'patia'].some(place => text.includes(place));
};

export const checkServiceability = ({ address = '', pincode = '', lat, lng } = {}) => {
  const detectedPincode = String(pincode || '').trim() || extractPincode(address);
  const gpsLocal = isLocalServiceZone(lat, lng);
  const pincodeLocal = isServiceablePincode(detectedPincode);
  const validPincode = isValidIndianPincode(detectedPincode);
  const addressLocal = isLocalAddressText(address);
  const hasPincode = Boolean(detectedPincode);
  const localServiceable = hasPincode ? pincodeLocal : (gpsLocal || addressLocal);
  const courierServiceable = hasPincode && validPincode && !localServiceable;
  const mode = localServiceable ? 'local' : courierServiceable ? 'courier' : 'blocked';

  return {
    serviceable: localServiceable || courierServiceable,
    localServiceable,
    courierServiceable,
    mode,
    detectedPincode,
    validPincode,
    gpsLocal,
    pincodeLocal,
    addressLocal
  };
};

export const getDeliveryEstimate = ({ address = '', pincode = '', lat, lng } = {}) => {
  const result = checkServiceability({ address, pincode, lat, lng });
  if (result.mode === 'local') {
    return {
      label: '16 mins',
      detail: 'Fast local delivery'
    };
  }
  if (result.mode === 'courier') {
    return {
      label: '2-4 days',
      detail: 'Courier dispatch'
    };
  }
  return {
    label: 'Check area',
    detail: 'Availability by location'
  };
};
