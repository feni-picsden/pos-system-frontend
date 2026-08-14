import React, { useEffect, useState } from 'react';
import { LinearProgress } from '@mui/material';

const progressSx = {
  height: 4,
  backgroundColor: 'rgba(255,255,255,0.12)',
  '& .MuiLinearProgress-bar': {
    backgroundColor: '#64b5f6',
  },
};


export function TopProgressBar({ variant = 'viewport' }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onLoading = (e) => setActive(Boolean(e.detail?.barActive));
    window.addEventListener('global-loading', onLoading);
    return () => window.removeEventListener('global-loading', onLoading);
  }, []);

  if (!active) return null;

  const placementSx =
    variant === 'appBar'
      ? {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1,
        }
      : {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
        };

  return (
    <LinearProgress
      variant="indeterminate"
      aria-hidden
      data-allow-animation="true"
      sx={{ ...placementSx, ...progressSx }}
    />
  );
}

export default function GlobalTopBar() {
  return <TopProgressBar variant="viewport" />;
}
