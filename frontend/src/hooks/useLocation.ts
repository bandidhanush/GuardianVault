import { useState, useEffect } from 'react';

interface LocationData {
    lat: number;
    lon: number;
    city?: string;
    area?: string;
    display: string;
    loading: boolean;
    error?: string;
}

export function useLocation() {
    const [location, setLocation] = useState<LocationData>({
        lat: 0, lon: 0, display: 'Locating...', loading: true,
    });

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocation(prev => ({ ...prev, loading: false, display: 'Geolocation not supported', error: 'not supported' }));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude: lat, longitude: lon } = pos.coords;
                setLocation(prev => ({ ...prev, lat, lon, display: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, loading: false }));

                // Reverse geocode using OpenStreetMap Nominatim
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
                        { headers: { 'Accept-Language': 'en' } }
                    );
                    const data = await res.json();
                    const area = data.address?.suburb || data.address?.neighbourhood || data.address?.county || '';
                    const city = data.address?.city || data.address?.town || data.address?.village || '';
                    const display = [area, city].filter(Boolean).join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
                    setLocation({ lat, lon, city, area, display, loading: false });
                } catch {
                    // Keep coordinate display if geocoding fails
                }
            },
            (err) => {
                setLocation({ lat: 0, lon: 0, display: 'Location unavailable', loading: false, error: err.message });
            },
            { timeout: 10000 }
        );
    }, []);

    return location;
}
