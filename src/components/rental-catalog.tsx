"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import type { MapProperty } from "@/components/Map";
import { AdvancedFilters, type PropertyFilters } from "@/components/advanced-filters";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[390px] animate-pulse rounded-3xl bg-slate-200" />,
});

type PropertyImage = {
  id: string;
  url: string | null;
  isPrimary: boolean;
  displayOrder: number;
};

type CatalogProperty = {
  id: string;
  title: string;
  address: string;
  monthlyRent: number;
  status: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  landlord: { id: string; fullName: string };
  services: string[];
  amenities: string[];
  images: PropertyImage[];
  image: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserLocation = { latitude: number; longitude: number };

function haversineDistanceKm(from: UserLocation, to: UserLocation): number {
  const earthRadiusKm = 6371;
  const latitudeDifference = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDifference = ((to.longitude - from.longitude) * Math.PI) / 180;
  const originLatitude = (from.latitude * Math.PI) / 180;
  const destinationLatitude = (to.latitude * Math.PI) / 180;
  const calculation = Math.sin(latitudeDifference / 2) ** 2 + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDifference / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(calculation));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("es-EC");
}

function toMapProperty(property: CatalogProperty): MapProperty | null {
  if (property.latitude === null || property.longitude === null) return null;
  return {
    id: property.id,
    title: property.title,
    sector: property.address,
    price: property.monthlyRent,
    latitude: property.latitude,
    longitude: property.longitude,
  };
}

export function RentalCatalog() {
  const [properties, setProperties] = useState<CatalogProperty[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<CatalogProperty | null>(null);
  const [filteredProperties, setFilteredProperties] = useState<CatalogProperty[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasIdentityDocument, setHasIdentityDocument] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactProperty, setContactProperty] = useState<CatalogProperty | null>(null);
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/properties", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar el catálogo");
        return data as { properties: CatalogProperty[] };
      })
      .then((data) => {
        setProperties(data.properties);
        setFilteredProperties(data.properties);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el catálogo");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    fetch("/api/identity-documents")
      .then(async (response) => {
        if (!response.ok) return { documents: [] };
        return response.json() as Promise<{ documents: Array<{ isCurrent: boolean }> }>;
      })
      .then((data) => setHasIdentityDocument(data.documents.some((document) => document.isCurrent)))
      .catch(() => setHasIdentityDocument(false));
  }, []);

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedProperty(null);
    }
    if (!selectedProperty) return;
    document.addEventListener("keydown", closeWithEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeWithEscape);
      document.body.style.overflow = "";
    };
  }, [selectedProperty]);

  const mapProperties = useMemo(() => filteredProperties.map(toMapProperty).filter((property): property is MapProperty => property !== null), [filteredProperties]);

  function openProperty(property: CatalogProperty) {
    setSelectedMapId(property.id);
    setSelectedProperty(property);
  }

  function focusMap(event: MouseEvent<HTMLButtonElement>, property: CatalogProperty) {
    event.stopPropagation();
    setSelectedMapId(property.id);
  }

  function openContactForm(property: CatalogProperty) {
    if (!hasIdentityDocument) return;
    setSelectedProperty(null);
    setContactProperty(property);
    setContactSent(false);
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasIdentityDocument) return;
    console.log("Contacto de propiedad pendiente de flujo propio:", { propertyId: contactProperty?.id, data: Object.fromEntries(new FormData(event.currentTarget)) });
    setContactSent(true);
  }

  function requestUserLocation(): Promise<UserLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocalización no disponible"));
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
        () => reject(new Error("No se pudo obtener la ubicación")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }

  async function applyFilters(filters: PropertyFilters) {
    const min = Number(filters.minPrice) || 0;
    const max = Number(filters.maxPrice) || Number.POSITIVE_INFINITY;
    const radius = filters.radius === "city" ? null : Number(filters.radius);
    let currentLocation = userLocation;
    setFilterError(null);

    if (radius !== null && !currentLocation) {
      try {
        currentLocation = await requestUserLocation();
        setUserLocation(currentLocation);
      } catch {
        setFilteredProperties([]);
        setSelectedMapId(null);
        setFilterError("Activa la ubicación del navegador para aplicar un filtro de cercanía.");
        return;
      }
    }

    const selectedServices = filters.services.map(normalize);
    const filtered = properties.filter((property) => {
      const availableLabels = new Set([...property.services, ...property.amenities].map(normalize));
      const matchesPrice = property.monthlyRent >= min && property.monthlyRent <= max;
      const matchesServices = selectedServices.every((service) => availableLabels.has(service));
      const matchesRadius = radius === null || property.latitude === null || property.longitude === null || !currentLocation || haversineDistanceKm(currentLocation, { latitude: property.latitude, longitude: property.longitude }) <= radius;
      return matchesPrice && matchesServices && matchesRadius;
    });
    setFilteredProperties(filtered);
    setSelectedMapId((current) => filtered.some((property) => property.id === current) ? current : null);
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[.16em] text-orange">Catálogo disponible</p><h2 className="mt-2 text-2xl font-black text-navy">Encuentra tu próximo hogar</h2></div>
          <span className="rounded-full bg-blue/10 px-3 py-1 text-sm font-bold text-blue">{filteredProperties.length} opciones</span>
        </div>
        <AdvancedFilters onApply={applyFilters} />
        {error ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {filterError ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{filterError}</p> : null}
        {loading ? <p className="rounded-xl bg-white p-6 text-slate-500">Cargando propiedades reales...</p> : null}
        {!loading && !error && filteredProperties.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No hay propiedades disponibles con esos filtros.</p> : null}
        {filteredProperties.length > 0 ? <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-start">
          <div className="grid gap-5 md:grid-cols-2">
            {filteredProperties.map((property) => <article key={property.id} role="button" tabIndex={0} onClick={() => openProperty(property)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openProperty(property); }} className={`cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${selectedMapId === property.id ? "border-sky ring-2 ring-sky/20" : "border-slate-200"}`}>
              <div className="relative h-44 bg-slate-200">{property.image ? <img src={property.image} alt={property.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm font-semibold text-slate-500">Sin imagen</div>}<span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-navy">Disponible</span><span className="absolute bottom-3 left-3 rounded-lg bg-navy/90 px-3 py-1 text-sm font-black text-white">${property.monthlyRent}<span className="font-normal text-blue-100"> / mes</span></span></div>
              <div className="space-y-4 p-5"><div><p className="text-sm font-semibold text-sky">{property.address}</p><h3 className="mt-1 line-clamp-2 min-h-12 text-lg font-black leading-6 text-navy">{property.title}</h3><p className="mt-2 text-sm text-slate-500">{property.bedrooms ?? "—"} hab. · {property.bathrooms ?? "—"} baños</p></div><div className="flex flex-wrap gap-2">{[...property.services, ...property.amenities].slice(0, 3).map((label) => <span key={label} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{label}</span>)}</div><button type="button" onClick={(event) => focusMap(event, property)} className="w-full rounded-xl border border-sky px-4 py-2.5 text-sm font-bold text-blue transition hover:bg-sky hover:text-white">Ver en mapa <span className="ml-1">↗</span></button></div>
            </article>)}
          </div>
          <div className="h-[390px] overflow-hidden rounded-3xl border border-slate-200 shadow-lg shadow-navy/10 lg:sticky lg:top-6 lg:h-[620px]"><Map properties={mapProperties} selectedId={selectedMapId} onSelect={(property) => setSelectedMapId(property.id)} /></div>
        </div> : null}
      </div>
            {selectedProperty ? <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProperty(null); }}><div role="dialog" aria-modal="true" aria-labelledby="property-modal-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="relative h-56 bg-slate-200 sm:h-72">{selectedProperty.image ? <img src={selectedProperty.image} alt={selectedProperty.title} className="h-full w-full object-cover" /> : null}<button type="button" aria-label="Cerrar detalles" onClick={() => setSelectedProperty(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-bold text-navy shadow-md">×</button><span className="absolute bottom-4 left-4 rounded-lg bg-navy/90 px-3 py-1.5 text-lg font-black text-white">${selectedProperty.monthlyRent}<span className="text-sm font-normal text-blue-100"> / mes</span></span></div><div className="space-y-6 p-6 sm:p-8"><div><p className="font-bold text-sky">{selectedProperty.address}</p><h2 id="property-modal-title" className="mt-2 text-2xl font-black leading-tight text-navy sm:text-3xl">{selectedProperty.title}</h2><p className="mt-2 text-sm text-slate-500">Propietario: {selectedProperty.landlord.fullName}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-blue/5 p-3 text-center"><p className="text-xl font-black text-blue">{selectedProperty.bedrooms ?? "—"}</p><p className="text-xs font-semibold text-slate-500">Habitaciones</p></div><div className="rounded-xl bg-blue/5 p-3 text-center"><p className="text-xl font-black text-blue">{selectedProperty.bathrooms ?? "—"}</p><p className="text-xs font-semibold text-slate-500">Baños</p></div></div><div><h3 className="text-lg font-black text-navy">Sobre esta propiedad</h3><p className="mt-2 leading-7 text-slate-600">{selectedProperty.description || "Sin descripción registrada."}</p></div><div><h3 className="text-lg font-black text-navy">Servicios y comodidades</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{[...selectedProperty.services, ...selectedProperty.amenities].map((label) => <div key={label} className="flex items-center gap-2 rounded-lg bg-violet/5 px-3 py-2 text-sm font-semibold text-violet"><span className="h-2 w-2 rounded-full bg-sky" />{label}</div>)}</div></div>{hasIdentityDocument ? <button type="button" onClick={() => openContactForm(selectedProperty)} className="w-full rounded-xl bg-orange px-6 py-3.5 font-bold text-white shadow-lg shadow-orange/20 transition hover:bg-[#d85c13]">Contactar al Arrendador</button> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p className="font-bold">Necesitas cargar un documento de identidad antes de contactar al arrendador.</p><Link href="/panel/documentos" className="mt-2 inline-block font-bold text-blue hover:underline">Ir a Mis documentos →</Link></div>}</div></div></div> : null}
      {contactProperty ? <div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactProperty(null); }}><div role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-orange">Contacto</p><h2 id="contact-modal-title" className="mt-2 text-2xl font-black text-navy">Contactar al Arrendador</h2><p className="mt-2 text-sm text-slate-500">Sobre: {contactProperty.title}</p></div><button type="button" aria-label="Cerrar contacto" onClick={() => setContactProperty(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xl font-bold text-navy">×</button></div>{contactSent ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">Mensaje preparado. El flujo de contacto sigue sin conectarse a solicitudes.</div> : <form onSubmit={submitContact} className="mt-6 space-y-4"><label className="block space-y-2"><span className="text-sm font-bold text-navy">Tu nombre</span><input required name="name" className="field-input" placeholder="Nombre completo" /></label><label className="block space-y-2"><span className="text-sm font-bold text-navy">Tu correo</span><input required type="email" name="email" className="field-input" placeholder="tu@correo.com" /></label><label className="block space-y-2"><span className="text-sm font-bold text-navy">Mensaje</span><textarea required name="message" rows={4} defaultValue={`Hola, me interesa la propiedad "${contactProperty.title}".`} className="field-input resize-y" /></label><button type="submit" className="w-full rounded-xl bg-orange px-6 py-3.5 font-bold text-white transition hover:bg-[#d85c13]">Enviar mensaje</button></form>}</div></div> : null}
    </>
  );
}
