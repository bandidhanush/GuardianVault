import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet + React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

interface MapViewProps {
    center: [number, number];
    zoom?: number;
    markers?: Array<{
        id: string;
        position: [number, number];
        label: string;
        type?: 'camera' | 'police' | 'hospital';
    }>;
    showRadius?: boolean;
}

const MapView: React.FC<MapViewProps> = ({ center, zoom = 13, markers = [], showRadius = false }) => {
    return (
        <div style={{ height: '100%', width: '100%', minHeight: '300px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                {markers.map((marker) => (
                    <React.Fragment key={marker.id}>
                        <Marker position={marker.position}>
                            <Popup>
                                <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{marker.label}</div>
                            </Popup>
                        </Marker>
                        {showRadius && marker.type === 'camera' && (
                            <Circle
                                center={marker.position}
                                radius={2000}
                                pathOptions={{ color: 'var(--accent-cyan)', fillColor: 'var(--accent-cyan)', fillOpacity: 0.1 }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapView;
