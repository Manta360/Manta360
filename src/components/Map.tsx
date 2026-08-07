"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { divIcon, type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapProperty = {
  id: string;
  title: string;
  sector: string;
  price: number;
  latitude: number;
  longitude: number;
};

type MapProps = {
  properties?: MapProperty[];
  selectedId?: string | null;
  onSelect?: (property: MapProperty) => void;
};

const MANTA_CENTER: [number, number] = [-0.9676, -80.7127];

function RecenterAutomatically({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(position, 15, { duration: 1 });
  }, [map, position]);

  return null;
}

function MapFocus({ selected }: { selected?: MapProperty }) {
  const map = useMap();

  useEffect(() => {
    if (!selected) return;
    map.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.8 });
    map.openPopup(
      `<strong>${selected.title}</strong><br/><span>${selected.sector}</span><br/><b>$${selected.price} / mes</b>`,
      [selected.latitude, selected.longitude],
    );
  }, [map, selected]);

  return null;
}

export default function Map({ properties = [], selectedId = null, onSelect }: MapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation([coords.latitude, coords.longitude]),
      () => {
        // Si el usuario rechaza el permiso o ocurre un error, se conserva Manta.
        setUserLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const userIcon = useMemo(
    () =>
      divIcon({
        className: "current-location-pin",
        html: '<span aria-hidden="true">●</span>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    [],
  );

  const center: LatLngExpression = MANTA_CENTER;

  return (
    <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLocation ? <RecenterAutomatically position={userLocation} /> : null}
      {userLocation ? (
        <Marker position={userLocation} icon={userIcon}>
          <Popup>Tu ubicación actual</Popup>
        </Marker>
      ) : null}
      <MapFocus selected={properties.find((property) => property.id === selectedId)} />
      {properties.map((property) => (
        <CircleMarker
          key={property.id}
          center={[property.latitude, property.longitude]}
          radius={selectedId === property.id ? 13 : 9}
          pathOptions={{ color: "#003366", weight: 3, fillColor: "#00A3E0", fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect?.(property) }}
        >
          <Popup>
            <strong>{property.title}</strong>
            <br />
            {property.sector}
            <br />
            <b>${property.price} / mes</b>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
