import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, TextField, Typography } from '@mui/material';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map click events
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Component to update map view when location changes
function MapViewUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const MapLocationPicker = ({
  latitude,
  longitude,
  radius,
  onLocationChange,
  onRadiusChange,
  height = 400,
}) => {
  const [position, setPosition] = useState(
    latitude && longitude ? [latitude, longitude] : null
  );
  const [mapCenter, setMapCenter] = useState(
    latitude && longitude ? [latitude, longitude] : [-25.2744, 133.7751] // Default to Australia center
  );
  const [mapZoom, setMapZoom] = useState(position ? 15 : 5);

  // Update position when latitude/longitude props change (e.g., when editing)
  useEffect(() => {
    if (latitude && longitude) {
      const newPosition = [latitude, longitude];
      setPosition(newPosition);
      setMapCenter(newPosition);
      setMapZoom(15);
    } else {
      setPosition(null);
    }
  }, [latitude, longitude]);

  const handleMapClick = (latlng) => {
    const newPosition = [latlng.lat, latlng.lng];
    setPosition(newPosition);
    setMapCenter(newPosition);
    if (onLocationChange) {
      onLocationChange(latlng.lat, latlng.lng);
    }
  };

  const handleMarkerDrag = (e) => {
    const marker = e.target;
    const newPosition = marker.getLatLng();
    setPosition([newPosition.lat, newPosition.lng]);
    if (onLocationChange) {
      onLocationChange(newPosition.lat, newPosition.lng);
    }
  };

  const handleRadiusChange = (e) => {
    const newRadius = parseFloat(e.target.value) || 0;
    if (onRadiusChange) {
      onRadiusChange(newRadius);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
        Outlet Location
      </Typography>
      <Box
        sx={{
          width: '100%',
          height: height,
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          mb: 2,
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapViewUpdater center={mapCenter ? { lat: mapCenter[0], lng: mapCenter[1] } : null} zoom={mapZoom} />
          {position && (
            <>
              <Marker
                position={position}
                draggable={true}
                eventHandlers={{
                  dragend: handleMarkerDrag,
                }}
              />
              {radius && radius > 0 && (
                <Circle
                  center={position}
                  radius={radius}
                  pathOptions={{
                    color: '#1976d2',
                    fillColor: '#1976d2',
                    fillOpacity: 0.2,
                    weight: 2,
                  }}
                />
              )}
            </>
          )}
        </MapContainer>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Latitude"
          type="number"
          value={position ? position[0].toFixed(6) : ''}
          onChange={(e) => {
            const lat = parseFloat(e.target.value);
            if (!isNaN(lat) && lat >= -90 && lat <= 90) {
              const newPosition = [lat, position ? position[1] : 0];
              setPosition(newPosition);
              setMapCenter(newPosition);
              if (onLocationChange) {
                onLocationChange(lat, newPosition[1]);
              }
            }
          }}
          fullWidth
          size="small"
          inputProps={{ step: 'any' }}
          helperText="Click on map or drag marker to set location"
        />
        <TextField
          label="Longitude"
          type="number"
          value={position ? position[1].toFixed(6) : ''}
          onChange={(e) => {
            const lng = parseFloat(e.target.value);
            if (!isNaN(lng) && lng >= -180 && lng <= 180) {
              const newPosition = [position ? position[0] : 0, lng];
              setPosition(newPosition);
              setMapCenter(newPosition);
              if (onLocationChange) {
                onLocationChange(newPosition[0], lng);
              }
            }
          }}
          fullWidth
          size="small"
          inputProps={{ step: 'any' }}
        />
      </Box>
      <TextField
        label="Allowed Radius (meters)"
        type="number"
        value={radius || ''}
        onChange={handleRadiusChange}
        fullWidth
        size="small"
        inputProps={{ min: 0, step: 10 }}
        helperText="Geofence radius in meters. Circle will be displayed on map."
      />
    </Box>
  );
};

export default MapLocationPicker;
