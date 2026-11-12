import { useCallback, useEffect, useState } from 'react';

/**
 * Localização atual do aparelho.
 * status: 'loading' | 'ok' | 'denied' | 'error' | 'unsupported'
 */
export function useGeolocation() {
  const [state, setState] = useState({ status: 'loading', position: null, accuracy: null });

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', position: null, accuracy: null });
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setState({
          status: 'ok',
          position: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        setState({
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
          position: null,
          accuracy: null,
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return { ...state, locate };
}
