import React, { createContext, useContext, useMemo, useState } from 'react';

// The active Price Set is owned by the sell screen (it lives on the sale, and a
// Change Price Set sale key switches it). The header that has to show it is
// mounted in DashboardLayout, outside the sell screen, so the name travels
// through this provider instead of being lifted into the sell screen's tree.
//
// Only the NAME is shared: the id stays in the sell screen, which is the single
// place that prices anything. `null` means the products' Default Price Set,
// which the header deliberately shows as nothing at all — default is the normal
// state and a permanent badge for it would be noise.
const ActivePriceSetContext = createContext(null);

export const useActivePriceSet = () => useContext(ActivePriceSetContext) || {};

export const ActivePriceSetProvider = ({ children }) => {
  const [activePriceSetName, setActivePriceSetName] = useState(null);

  const value = useMemo(
    () => ({ activePriceSetName, setActivePriceSetName }),
    [activePriceSetName]
  );

  return (
    <ActivePriceSetContext.Provider value={value}>
      {children}
    </ActivePriceSetContext.Provider>
  );
};

export default ActivePriceSetContext;
