"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import type { MapProperty } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[390px] animate-pulse rounded-3xl bg-slate-200" />,
});

type Property = MapProperty & {
  bedrooms: number;
  bathrooms: number;
  description: string;
  amenities: string[];
  image: string;
  details: string;
};

const properties: Property[] = [
  {
    id: 1,
    title: "Departamento en Barbasquillo - Vista al Mar",
    sector: "Barbasquillo, Manta",
    price: 450,
    latitude: -0.9535,
    longitude: -80.7412,
    bedrooms: 2,
    bathrooms: 2,
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1100&q=85",
    details: "2 hab. · 2 baños · 86 m²",
    description: "Hermoso departamento con vista al mar ubicado en Barbasquillo, uno de los sectores más tranquilos y exclusivos de Manta. Cuenta con espacios amplios, excelente iluminación y acceso rápido a restaurantes, playa y servicios.",
    amenities: ["Piscina", "Seguridad Privada", "Wi-Fi", "Parqueo"],
  },
  {
    id: 2,
    title: "Suite Amoblada en Flavio Reyes",
    sector: "Av. Flavio Reyes, Manta",
    price: 300,
    latitude: -0.954,
    longitude: -80.728,
    bedrooms: 1,
    bathrooms: 1,
    image: "https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=1100&q=85",
    details: "1 hab. · 1 baño · 48 m²",
    description: "Suite amoblada y lista para vivir en la avenida Flavio Reyes. Una opción práctica para estudiantes o profesionales, cerca de comercios, restaurantes, transporte y del perfil costero de Manta.",
    amenities: ["Amoblado", "Wi-Fi", "Seguridad", "Cocina equipada"],
  },
  {
    id: 3,
    title: "Casa Residencial cerca de Playa El Murciélago",
    sector: "El Murciélago, Manta",
    price: 600,
    latitude: -0.9498,
    longitude: -80.7315,
    bedrooms: 3,
    bathrooms: 2,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1100&q=85",
    details: "3 hab. · 2 baños · 140 m²",
    description: "Amplia casa residencial cerca de Playa El Murciélago, ideal para una familia. Está ubicada en una zona residencial con buena conectividad y ofrece patio, ambientes cómodos y espacio para disfrutar de la vida costera.",
    amenities: ["Patio", "Garaje", "Mascotas", "Seguridad Privada"],
  },
  {
    id: 4,
    title: "Estudio cerca de PUCE Manabí / Av. Universitaria",
    sector: "Av. Universitaria, Manta",
    price: 250,
    latitude: -0.968,
    longitude: -80.715,
    bedrooms: 1,
    bathrooms: 1,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1100&q=85",
    details: "1 hab. · 1 baño · 32 m²",
    description: "Estudio funcional y luminoso cerca de PUCE Manabí y la avenida Universitaria. Su ubicación es ideal para estudiantes, con acceso sencillo a centros educativos, tiendas y transporte urbano.",
    amenities: ["Wi-Fi", "Cocina", "Estudiantes", "Parqueo"],
  },
];

export function RentalCatalog() {
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [contactProperty, setContactProperty] = useState<Property | null>(null);
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedProperty(null);
    }

    if (selectedProperty) {
      document.addEventListener("keydown", closeWithEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", closeWithEscape);
      document.body.style.overflow = "";
    };
  }, [selectedProperty]);

  function openProperty(property: Property) {
    setSelectedMapId(property.id);
    setSelectedProperty(property);
  }

  function focusMap(event: MouseEvent<HTMLButtonElement>, property: Property) {
    event.stopPropagation();
    setSelectedMapId(property.id);
  }

  function openContactForm(property: Property) {
    setSelectedProperty(null);
    setContactProperty(property);
    setContactSent(false);
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log("Solicitud de contacto:", { property: contactProperty?.title, data: Object.fromEntries(new FormData(event.currentTarget)) });
    setContactSent(true);
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:items-start">
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-sm font-bold uppercase tracking-[.16em] text-orange">Catálogo disponible</p><h2 className="mt-2 text-2xl font-black text-navy">Encuentra tu próximo hogar</h2></div>
            <span className="rounded-full bg-blue/10 px-3 py-1 text-sm font-bold text-blue">{properties.length} opciones</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {properties.map((property) => <article key={property.id} role="button" tabIndex={0} onClick={() => openProperty(property)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openProperty(property); }} className={`cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${selectedMapId === property.id ? "border-sky ring-2 ring-sky/20" : "border-slate-200"}`}>
              <div className="relative h-44 bg-slate-200"><img src={property.image} alt={property.title} className="h-full w-full object-cover" /><span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-navy">Disponible</span><span className="absolute bottom-3 left-3 rounded-lg bg-navy/90 px-3 py-1 text-sm font-black text-white">${property.price}<span className="font-normal text-blue-100"> / mes</span></span></div>
              <div className="space-y-4 p-5"><div><p className="text-sm font-semibold text-sky">{property.sector}</p><h3 className="mt-1 line-clamp-2 min-h-12 text-lg font-black leading-6 text-navy">{property.title}</h3><p className="mt-2 text-sm text-slate-500">{property.details}</p></div><div className="flex flex-wrap gap-2">{property.amenities.slice(0, 3).map((amenity) => <span key={amenity} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{amenity}</span>)}</div><button type="button" onClick={(event) => focusMap(event, property)} className="w-full rounded-xl border border-sky px-4 py-2.5 text-sm font-bold text-blue transition hover:bg-sky hover:text-white">Ver en mapa <span className="ml-1">↗</span></button></div>
            </article>)}
          </div>
        </div>
        <div className="h-[390px] overflow-hidden rounded-3xl border border-slate-200 shadow-lg shadow-navy/10 lg:sticky lg:top-6 lg:h-[620px]"><Map properties={properties} selectedId={selectedMapId} onSelect={(property) => setSelectedMapId(property.id)} /></div>
      </div>

      {selectedProperty ? <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProperty(null); }}><div role="dialog" aria-modal="true" aria-labelledby="property-modal-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="relative h-56 sm:h-72"><img src={selectedProperty.image} alt={selectedProperty.title} className="h-full w-full object-cover" /><button type="button" aria-label="Cerrar detalles" onClick={() => setSelectedProperty(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-bold text-navy shadow-md transition hover:bg-slate-100">×</button><span className="absolute bottom-4 left-4 rounded-lg bg-navy/90 px-3 py-1.5 text-lg font-black text-white">${selectedProperty.price}<span className="text-sm font-normal text-blue-100"> / mes</span></span></div><div className="space-y-6 p-6 sm:p-8"><div><p className="font-bold text-sky">{selectedProperty.sector} · Manta</p><h2 id="property-modal-title" className="mt-2 text-2xl font-black leading-tight text-navy sm:text-3xl">{selectedProperty.title}</h2></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-blue/5 p-3 text-center"><p className="text-xl font-black text-blue">{selectedProperty.bedrooms}</p><p className="text-xs font-semibold text-slate-500">Cuartos</p></div><div className="rounded-xl bg-blue/5 p-3 text-center"><p className="text-xl font-black text-blue">{selectedProperty.bathrooms}</p><p className="text-xs font-semibold text-slate-500">Baños</p></div><div className="rounded-xl bg-blue/5 p-3 text-center sm:col-span-2"><p className="text-xl font-black text-blue">{selectedProperty.details.split("·").at(-1)?.trim() ?? ""}</p><p className="text-xs font-semibold text-slate-500">Superficie</p></div></div><div><h3 className="text-lg font-black text-navy">Sobre esta propiedad</h3><p className="mt-2 leading-7 text-slate-600">{selectedProperty.description}</p></div><div><h3 className="text-lg font-black text-navy">Servicios y comodidades</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedProperty.amenities.map((amenity) => <div key={amenity} className="flex items-center gap-2 rounded-lg bg-violet/5 px-3 py-2 text-sm font-semibold text-violet"><span className="h-2 w-2 rounded-full bg-sky" />{amenity}</div>)}</div></div><button type="button" onClick={() => openContactForm(selectedProperty)} className="w-full rounded-xl bg-orange px-6 py-3.5 font-bold text-white shadow-lg shadow-orange/20 transition hover:bg-[#d85c13]">Contactar al Arrendador</button></div></div></div> : null}
      {contactProperty ? <div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactProperty(null); }}><div role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-orange">Contacto</p><h2 id="contact-modal-title" className="mt-2 text-2xl font-black text-navy">Contactar al Arrendador</h2><p className="mt-2 text-sm text-slate-500">Sobre: {contactProperty.title}</p></div><button type="button" aria-label="Cerrar contacto" onClick={() => setContactProperty(null)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-xl font-bold text-navy">×</button></div>{contactSent ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">¡Mensaje enviado! El arrendador recibirá tu solicitud de contacto.</div> : <form onSubmit={submitContact} className="mt-6 space-y-4"><label className="block space-y-2"><span className="text-sm font-bold text-navy">Tu nombre</span><input required name="name" className="field-input" placeholder="Nombre completo" /></label><label className="block space-y-2"><span className="text-sm font-bold text-navy">Tu correo</span><input required type="email" name="email" className="field-input" placeholder="tu@correo.com" /></label><label className="block space-y-2"><span className="text-sm font-bold text-navy">Mensaje</span><textarea required name="message" rows={4} defaultValue={`Hola, me interesa la propiedad "${contactProperty.title}".`} className="field-input resize-y" /></label><button type="submit" className="w-full rounded-xl bg-orange px-6 py-3.5 font-bold text-white transition hover:bg-[#d85c13]">Enviar mensaje</button></form>}</div></div> : null}
    </>
  );
}
