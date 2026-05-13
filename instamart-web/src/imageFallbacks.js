const normalizeText = (value = '') => String(value || '').toLowerCase();

const CATEGORY_FALLBACKS = {
  'night color ahd cameras': '/images/cgi-hd3e.jpg',
  'ip cameras': '/images/cgi-ipd5.jpg',
  'ptz cameras': '/images/cgi-ptz4g.jpg',
  'dvr recorders': '/images/cgi-dvr8.jpg',
  'nvr recorders': '/images/cgi-nvr8.jpg',
  'poe switches': '/images/cgi-poe4.jpg',
  'smps power supplies': '/images/cgi-smps4.jpg',
  accessories: '/images/cgi-accessory-box.jpg'
};

export function getProductFallbackImage(product = {}) {
  const name = normalizeText(product.name);
  const description = normalizeText(product.description);
  const category = normalizeText(product.category_name || product.category || product.categoryLabel);
  const haystack = `${name} ${description} ${category}`;

  if (haystack.includes('cat6') || haystack.includes('cable')) return '/images/cgi-accessory-cable.jpg';
  if (haystack.includes('bnc')) return '/images/cgi-accessory-bnc.jpg';
  if (haystack.includes('dc connector') || haystack.includes('connector')) return '/images/cgi-accessory-dc.jpg';
  if (haystack.includes('power supply') || haystack.includes('smps')) {
    if (haystack.includes('16ch') || haystack.includes('16 channel')) return '/images/cgi-smps16.jpg';
    if (haystack.includes('8ch') || haystack.includes('8 channel')) return '/images/cgi-smps8.jpg';
    return '/images/cgi-smps4.jpg';
  }

  if (haystack.includes('ptz')) {
    if (haystack.includes('36x') && haystack.includes('5mp') && haystack.includes('poe')) return '/images/cgi-ptz36x5p.jpg';
    if (haystack.includes('36x') && haystack.includes('4mp') && haystack.includes('poe')) return '/images/cgi-ptz36x4p.jpg';
    if (haystack.includes('36x') && haystack.includes('5mp')) return '/images/cgi-ptz36x5.jpg';
    if (haystack.includes('36x') && haystack.includes('4mp')) return '/images/cgi-ptz36x4.jpg';
    return '/images/cgi-ptz4g.jpg';
  }

  if (haystack.includes('nvr')) {
    if (haystack.includes('128ch')) return '/images/cgi-nvr128.jpg';
    if (haystack.includes('64ch')) return '/images/cgi-nvr64.jpg';
    if (haystack.includes('32ch')) return '/images/cgi-nvr32.jpg';
    if (haystack.includes('16ch')) return '/images/cgi-nvr16.jpg';
    if (haystack.includes('8ch')) return '/images/cgi-nvr8.jpg';
    if (haystack.includes('4ch')) return '/images/cgi-nvr4.jpg';
    return '/images/cgi-nvr8.jpg';
  }

  if (haystack.includes('dvr')) {
    if (haystack.includes('64ch')) return '/images/cgi-dvr64.jpg';
    if (haystack.includes('32ch')) return '/images/cgi-dvr32.jpg';
    if (haystack.includes('16ch')) return '/images/cgi-dvr16.jpg';
    if (haystack.includes('8ch')) return '/images/cgi-dvr8.jpg';
    if (haystack.includes('4ch')) return '/images/cgi-dvr4.jpg';
    return '/images/cgi-dvr8.jpg';
  }

  if (haystack.includes('poe')) {
    const isGiga = haystack.includes('giga') || haystack.includes('1000');
    if (haystack.includes('16ch') || haystack.includes('16 port')) return isGiga ? '/images/cgi-poe16g.jpg' : '/images/cgi-poe16.jpg';
    if (haystack.includes('8ch') || haystack.includes('8 port')) return isGiga ? '/images/cgi-poe8g.jpg' : '/images/cgi-poe8.jpg';
    if (haystack.includes('4ch') || haystack.includes('4 port')) return isGiga ? '/images/cgi-poe4g.jpg' : '/images/cgi-poe4.jpg';
    return isGiga ? '/images/cgi-poe8g.jpg' : '/images/cgi-poe8.jpg';
  }

  if (haystack.includes('solar')) return '/images/cgi-solcam18.jpg';

  if (haystack.includes('bullet')) {
    if (haystack.includes('4k') || haystack.includes('8mp')) {
      if (haystack.includes('big-bullet')) return '/images/cgi-ipbb8.jpg';
      return '/images/cgi-ipb8.jpg';
    }
    if (haystack.includes('5mp')) {
      if (haystack.includes('audio') || haystack.includes('night color') || haystack.includes('ahd')) return '/images/cgi-hb5.jpg';
      if (haystack.includes('varifocal')) return '/images/cgi-ipbvf5.jpg';
      return '/images/cgi-ipb5.jpg';
    }
    if (haystack.includes('3mp')) {
      if (haystack.includes('audio') || haystack.includes('night color') || haystack.includes('ahd')) return '/images/cgi-hb3e.jpg';
      return '/images/cgi-ipb3.jpg';
    }
  }

  if (haystack.includes('dome')) {
    if (haystack.includes('4k') || haystack.includes('8mp')) return '/images/cgi-ipd8.jpg';
    if (haystack.includes('5mp')) {
      if (haystack.includes('audio') || haystack.includes('night color') || haystack.includes('ahd')) return '/images/cgi-hd5.jpg';
      return '/images/cgi-ipd5.jpg';
    }
    if (haystack.includes('3mp')) {
      if (haystack.includes('audio') || haystack.includes('night color') || haystack.includes('ahd')) return '/images/cgi-hd3e.jpg';
      return '/images/cgi-ipd3.jpg';
    }
  }

  if (category && CATEGORY_FALLBACKS[category]) return CATEGORY_FALLBACKS[category];

  return '/images/cgi-hd3e.jpg';
}

export function buildProductImageSources(product = {}) {
  const sourceSet = new Set();
  const push = (value) => {
    const clean = String(value || '').trim();
    if (clean) sourceSet.add(clean);
  };

  push(product.image);
  if (Array.isArray(product.images)) {
    product.images.forEach((value) => push(value));
  }

  push(getProductFallbackImage(product));

  return Array.from(sourceSet);
}
