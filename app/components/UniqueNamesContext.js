'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const UniqueNamesContext = createContext({
  showUniqueNames: false,
  toggleUniqueNames: () => {}
});

export function UniqueNamesProvider({ children }) {
  const [showUniqueNames, setShowUniqueNames] = useState(false);

  useEffect(() => {
    if (showUniqueNames) {
      document.body.classList.add('show-unique-names');
    } else {
      document.body.classList.remove('show-unique-names');
    }
  }, [showUniqueNames]);

  const toggleUniqueNames = () => {
    setShowUniqueNames(prev => !prev);
  };

  return (
    <UniqueNamesContext.Provider data-element-name="רכיב_UniqueNamesContext_1" value={{ showUniqueNames, toggleUniqueNames }}>
      {children}
    </UniqueNamesContext.Provider>
  );
}

export function useUniqueNames() {
  return useContext(UniqueNamesContext);
}
