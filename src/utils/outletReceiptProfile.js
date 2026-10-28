// The outlet's receipt header details that Setup > Outlets stores in the
// `outlet_profile_<id>` setting (logo, ABN / business number, contact and
// address) rather than on the Outlet row. The receipt paths all build their
// `outlet` from the row alone, which is why the printed header had no logo and
// no ABN. Merge the profile in here; cached per outlet for the session.
import settingsService from '../services/settingsService';

const cache = new Map();

export const loadOutletProfile = async (outletId) => {
  if (!outletId) return null;
  if (cache.has(outletId)) return cache.get(outletId);
  let profile = null;
  try {
    // Canonical key uses underscores; older saves used hyphens - read both.
    let res;
    try {
      res = await settingsService.getSetting(`outlet_profile_${outletId}`);
    } catch {
      res = await settingsService.getSetting(`outlet-profile-${outletId}`);
    }
    const value = res?.setting?.value;
    profile = value && typeof value === 'object' ? value : null;
  } catch {
    profile = null; // no profile saved yet
  }
  cache.set(outletId, profile);
  return profile;
};

export const clearOutletProfileCache = () => cache.clear();

// Pure: the outlet row + its profile -> what the receipt header reads
// ({outlet.name}, {outlet.contact.*}, {outlet.contact.abn}, data.logo).
export const mergeOutletProfile = (outlet, profile) => {
  if (!outlet) return outlet;
  const p = profile || {};
  const street = [p.street1, p.street2].filter((s) => s && String(s).trim()).join(', ');
  return {
    ...outlet,
    logo: outlet.logo || outlet.receiptLogo || p.logo || null,
    abn: outlet.abn || p.businessNumber || '',
    phone: outlet.phone || p.phone || '',
    email: outlet.email || p.email || '',
    website: outlet.website || p.website || '',
    address: outlet.address || street || '',
    suburb: outlet.suburb || p.suburb || p.city || '',
    state: outlet.state || p.state || '',
    postcode: outlet.postcode || p.postcode || '',
  };
};

// The business block the statement / payment receipt print ({businessName},
// {businessAddress}, ...): street line, then "Suburb STATE postcode".
export const businessOf = (outlet, profile) => {
  if (!outlet) return null;
  const p = profile || {};
  const line1 = [p.street1, p.street2].filter(Boolean).join(', ');
  const line2 = [p.suburb || p.city, p.state, p.postcode].filter(Boolean).join(' ');
  const address = [line1, line2].filter(Boolean).join(',<br/>') || outlet.address || '';
  return {
    name: outlet.name || '',
    address,
    email: p.email || outlet.email || '',
    phone: p.phone || outlet.phone || '',
    abn: p.businessNumber || outlet.abn || '',
    logo: p.logo || outlet.receiptLogo || outlet.logo || '',
  };
};

export const loadBusiness = async (outlet) =>
  (outlet ? businessOf(outlet, await loadOutletProfile(outlet.id)) : null);

export const withOutletProfile = async (receiptData) => {
  const outlet = receiptData?.outlet;
  if (!outlet?.id) return receiptData;
  return { ...receiptData, outlet: mergeOutletProfile(outlet, await loadOutletProfile(outlet.id)) };
};
