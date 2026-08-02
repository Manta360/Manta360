"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { divIcon, type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

const MANTA_CENTER: [number, number] = [-0.9676, -80.7127];
type Props = { latitude: string; longitude: string; onChange: (latitude: string, longitude: string) => void };

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: ({ latlng }) => onSelect(latlng.lat, latlng.lng) });
  return null;
}

function MapViewUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 16, { duration: 0.8 }); }, [map, position]);
  return null;
}

export function LocationPickerMap({ latitude, longitude, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const hasPosition = latitude !== "" && longitude !== "" && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const position = hasPosition ? ([Number(latitude), Number(longitude)] as [number, number]) : null;
  const center: LatLngExpression = position ?? MANTA_CENTER;
  const markerIcon = useMemo(() => divIcon({ className: "property-location-pin", html: "<span>●</span>", iconSize: [28, 28], iconAnchor: [14, 14] }), []);

  function selectPosition(lat: number, lng: number) { onChange(lat.toFixed(6), lng.toFixed(6)); setSearchError(""); }

  async function searchAddress() {
    if (!query.trim()) return;
    setSearching(true); setSearchError("");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ec&q=${encodeURIComponent(`${query.trim()}, Manta, Ecuador`)}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Search failed");
      const results = (await response.json()) as Array<{ lat: string; lon: string }>;
      if (!results[0]) { setSearchError("No encontramos esa dirección. Prueba con una calle o avenida más específica."); return; }
      selectPosition(Number(results[0].lat), Number(results[0].lon));
    } catch { setSearchError("No se pudo buscar la dirección. Intenta nuevamente."); } finally { setSearching(false); }
  }

  return <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchAddress(); } }} placeholder="Buscar calle, avenida o sector de Manta" className="field-input flex-1" /><button type="button" onClick={() => void searchAddress()} disabled={searching} className="rounded-xl bg-blue px-5 py-3 font-bold text-white transition hover:bg-navy disabled:opacity-60">{searching ? "Buscando..." : "Buscar en mapa"}</button></div><div className="relative h-[360px] w-full"><MapContainer center={center} zoom={position ? 16 : 14} scrollWheelZoom className="h-full w-full"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><MapClickHandler onSelect={selectPosition} /><MapViewUpdater position={position} />{position ? <Marker position={position} icon={markerIcon} draggable eventHandlers={{ dragend: (event) => { const marker = event.target; const point = marker.getLatLng(); selectPosition(point.lat, point.lng); } }}><Popup>Ubicación de tu propiedad</Popup></Marker> : <CircleMarker center={MANTA_CENTER} radius={8} pathOptions={{ color: "#003366", fillColor: "#00A3E0", fillOpacity: 0.8 }}><Popup>Centro de Manta. Haz clic en el mapa para ubicar la propiedad.</Popup></CircleMarker>}</MapContainer><span className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-navy shadow">Haz clic o arrastra el pin para ubicar la propiedad</span></div>{searchError ? <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{searchError}</p> : null}</div>;
}
