import { useState, useEffect } from 'react';

export function useResponsive() {
  const [device, setDevice] = useState('desktop');
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWidth(w);
      if (w < 768) setDevice('mobile');
      else if (w < 1024) setDevice('tablet');
      else if (w < 1400) setDevice('laptop');
      else setDevice('desktop');
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { device, width, isMobile: device === 'mobile', isTablet: device === 'tablet' };
}