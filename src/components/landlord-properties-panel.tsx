"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type PropertyImage = { id: string; url: string | null; isPrimary: boolean; displayOrder: number };
type Property = {
  id: string;
  title: string;
  address: string;
  monthlyRent: number;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "DISPONIBLE" | "OCUPADO" | "MANTENIMIENTO" | "INHABILITADO";
  approved: boolean;
  disableReason: string | null;
  createdAt: string;
  updatedAt: string;
  services: string[];
  amenities: string[];
  images: PropertyImage[];
  image: string | null;
};

type EditableValues = {
  title: string;
  address: string;
  monthlyRent: string;
  bedrooms: string;
  bathrooms: string;
  description: string;
  latitude: string;
  longitude: string;
  services: string;
  amenities: string;
};

function valuesFrom(property: Property): EditableValues {
  return {
    title: property.title,
    address: property.address,
    monthlyRent: String(property.monthlyRent),
    bedrooms: String(property.bedrooms ?? 0),
    bathrooms: String(property.bathrooms ?? 0),
    description: property.description ?? "",
    latitude: String(property.latitude ?? ""),
    longitude: String(property.longitude ?? ""),
    services: property.services.join(", "),
    amenities: property.amenities.join(", "),
  };
}

function labels(value: string): string[] {
  return value.split(",").map((label) => label.trim()).filter(Boolean);
}

function statusLabel(status: Property["status"]) {
  return { DISPONIBLE: "Disponible", OCUPADO: "Ocupado", MANTENIMIENTO: "Mantenimiento", INHABILITADO: "Inhabilitada" }[status];
}

export function LandlordPropertiesPanel() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<Property | null>(null);
  const [editing, setEditing] = useState<Property | null>(null);
  const [values, setValues] = useState<EditableValues | null>(null);
  const [imagesProperty, setImagesProperty] = useState<Property | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/properties/mine", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar tus propiedades");
      setProperties(data.properties ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar tus propiedades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
    const refresh = () => void loadProperties();
    window.addEventListener("property-created", refresh);
    return () => window.removeEventListener("property-created", refresh);
  }, [loadProperties]);

  function clearFeedback() { setError(""); setNotice(""); }

  async function getDetail(propertyId: string) {
    clearFeedback();
    try {
      const response = await fetch(`/api/properties/${propertyId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la propiedad");
      setSelected(data.property);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "No se pudo cargar la propiedad");
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !values) return;
    clearFeedback(); setSaving(true);
    try {
      const response = await fetch(`/api/properties/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          address: values.address,
          monthlyRent: Number(values.monthlyRent),
          bedrooms: Number(values.bedrooms),
          bathrooms: Number(values.bathrooms),
          description: values.description,
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
          services: labels(values.services),
          amenities: labels(values.amenities),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo actualizar la propiedad");
      setNotice("Propiedad actualizada correctamente.");
      setSelected(data.property); setEditing(null); setValues(null);
      await loadProperties();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la propiedad");
    } finally { setSaving(false); }
  }

  async function changeStatus(property: Property, status: "DISPONIBLE" | "MANTENIMIENTO") {
    clearFeedback(); setSaving(true);
    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo cambiar el estado");
      setNotice(`Estado actualizado a ${statusLabel(status)}.`);
      setSelected(data.property); await loadProperties();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo cambiar el estado");
    } finally { setSaving(false); }
  }

  async function deleteProperty(property: Property) {
    if (!window.confirm(`¿Eliminar definitivamente “${property.title}”? Esta acción no se puede deshacer.`)) return;
    clearFeedback(); setSaving(true);
    try {
      const response = await fetch(`/api/properties/${property.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo eliminar la propiedad");
      }
      setNotice("Propiedad eliminada correctamente.");
      if (selected?.id === property.id) setSelected(null);
      await loadProperties();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la propiedad");
    } finally { setSaving(false); }
  }

  async function openImages(property: Property) {
    clearFeedback();
    try {
      const response = await fetch(`/api/properties/${property.id}/images`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las imágenes");
      setImagesProperty(property); setImages(data.images ?? []);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "No se pudieron cargar las imágenes");
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!imagesProperty || !files?.length) return;
    clearFeedback(); setSaving(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("photos", file));
      const response = await fetch(`/api/properties/${imagesProperty.id}/images`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar las imágenes");
      setNotice("Imágenes agregadas correctamente.");
      await openImages(imagesProperty); await loadProperties();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudieron cargar las imágenes");
    } finally { setSaving(false); }
  }

  async function updateImage(image: PropertyImage, data: { isPrimary?: boolean }) {
    if (!imagesProperty) return;
    clearFeedback(); setSaving(true);
    try {
      const response = await fetch(`/api/properties/${imagesProperty.id}/images/${image.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudo actualizar la imagen");
      await openImages(imagesProperty); await loadProperties();
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "No se pudo actualizar la imagen");
    } finally { setSaving(false); }
  }

  async function deleteImage(image: PropertyImage) {
    if (!imagesProperty || !window.confirm("¿Eliminar esta imagen?")) return;
    clearFeedback(); setSaving(true);
    try {
      const response = await fetch(`/api/properties/${imagesProperty.id}/images/${image.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo eliminar la imagen");
      }
      setNotice("Imagen eliminada correctamente.");
      await openImages(imagesProperty); await loadProperties();
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "No se pudo eliminar la imagen");
    } finally { setSaving(false); }
  }

  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
    <div><p className="text-sm font-bold uppercase tracking-[.16em] text-sky">Gestión</p><h2 className="mt-2 text-2xl font-black text-navy">Mis propiedades</h2><p className="mt-2 text-sm text-slate-500">Administra únicamente los inmuebles registrados con tu cuenta.</p></div>
    {error ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{notice}</p> : null}
    {loading ? <p className="text-sm text-slate-500">Cargando propiedades…</p> : null}
    {!loading && properties.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Aún no tienes propiedades publicadas.</p> : null}
    <div className="grid gap-4 lg:grid-cols-2">{properties.map((property) => {
      const locked = property.status === "INHABILITADO";
      return <article key={property.id} className="overflow-hidden rounded-xl border border-slate-200">
        {property.image ? <img src={property.image} alt={property.title} className="h-44 w-full object-cover" /> : <div className="grid h-44 place-items-center bg-slate-100 text-sm text-slate-500">Sin imagen principal</div>}
        <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-navy">{property.title}</h3><p className="text-sm text-slate-600">{property.address}</p></div><span className="rounded-full bg-blue/10 px-2.5 py-1 text-xs font-bold text-blue">{statusLabel(property.status)}</span></div>
          <p className="font-bold text-navy">${property.monthlyRent.toFixed(2)} / mes</p>
          <p className={`text-sm font-semibold ${property.approved ? "text-emerald-700" : "text-amber-700"}`}>{property.approved ? "Aprobada por Municipio" : "Pendiente de aprobación municipal"}</p>
          {locked ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">Inhabilitada por Municipio{property.disableReason ? `: ${property.disableReason}` : "."}</p> : null}
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void getDetail(property.id)} className="rounded-lg border border-blue px-3 py-2 text-sm font-bold text-blue">Ver</button>
            <button type="button" disabled={locked || saving} onClick={() => { setEditing(property); setValues(valuesFrom(property)); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy disabled:opacity-45">Editar</button>
            <button type="button" disabled={locked || saving} onClick={() => void openImages(property)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-navy disabled:opacity-45">Imágenes</button>
            {property.status === "DISPONIBLE" || property.status === "MANTENIMIENTO" ? <button type="button" disabled={saving} onClick={() => void changeStatus(property, property.status === "DISPONIBLE" ? "MANTENIMIENTO" : "DISPONIBLE")} className="rounded-lg border border-violet px-3 py-2 text-sm font-bold text-violet disabled:opacity-45">{property.status === "DISPONIBLE" ? "Enviar a mantenimiento" : "Marcar disponible"}</button> : null}
            <button type="button" disabled={locked || saving} onClick={() => void deleteProperty(property)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-45">Eliminar</button></div>
        </div></article>;
    })}</div>

    {selected ? <section className="rounded-xl border border-blue/30 bg-blue/5 p-5"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase text-blue">Detalle</p><h3 className="mt-1 text-xl font-black text-navy">{selected.title}</h3></div><button type="button" onClick={() => setSelected(null)} className="text-sm font-bold text-blue">Cerrar</button></div><p className="mt-3 text-sm text-slate-700">{selected.description}</p><p className="mt-3 text-sm text-slate-600">{selected.bedrooms} habitaciones · {selected.bathrooms} baños · {selected.services.join(", ") || "Sin servicios registrados"}</p></section> : null}

    {editing && values ? <form onSubmit={saveEdit} className="space-y-4 rounded-xl border border-sky/30 bg-sky/5 p-5"><div className="flex justify-between gap-3"><h3 className="text-xl font-black text-navy">Editar {editing.title}</h3><button type="button" onClick={() => { setEditing(null); setValues(null); }} className="text-sm font-bold text-blue">Cancelar</button></div><div className="grid gap-3 md:grid-cols-2">{(["title", "address", "monthlyRent", "bedrooms", "bathrooms", "latitude", "longitude"] as const).map((field) => <label key={field} className="space-y-1"><span className="text-sm font-bold text-navy">{{ title: "Título", address: "Dirección", monthlyRent: "Precio mensual", bedrooms: "Habitaciones", bathrooms: "Baños", latitude: "Latitud", longitude: "Longitud" }[field]}</span><input required type={["monthlyRent", "bedrooms", "bathrooms", "latitude", "longitude"].includes(field) ? "number" : "text"} step="any" value={values[field]} onChange={(event) => setValues({ ...values, [field]: event.target.value })} className="field-input" /></label>)}</div><label className="block space-y-1"><span className="text-sm font-bold text-navy">Descripción</span><textarea required rows={3} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} className="field-input" /></label><div className="grid gap-3 md:grid-cols-2"><label className="space-y-1"><span className="text-sm font-bold text-navy">Servicios (separados por coma)</span><input value={values.services} onChange={(event) => setValues({ ...values, services: event.target.value })} className="field-input" /></label><label className="space-y-1"><span className="text-sm font-bold text-navy">Comodidades (separadas por coma)</span><input value={values.amenities} onChange={(event) => setValues({ ...values, amenities: event.target.value })} className="field-input" /></label></div><button disabled={saving} className="rounded-lg bg-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Guardando…" : "Guardar cambios"}</button></form> : null}

    {imagesProperty ? <section className="rounded-xl border border-violet/30 bg-violet/[.03] p-5"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase text-violet">Imágenes</p><h3 className="mt-1 text-xl font-black text-navy">{imagesProperty.title}</h3></div><button type="button" onClick={() => setImagesProperty(null)} className="text-sm font-bold text-blue">Cerrar</button></div><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { void uploadImages(event.target.files); event.target.value = ""; }} /><button type="button" disabled={saving} onClick={() => imageInputRef.current?.click()} className="mt-4 rounded-lg border border-violet px-4 py-2 text-sm font-bold text-violet disabled:opacity-60">Agregar imágenes</button><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((image) => <div key={image.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">{image.url ? <img src={image.url} alt="Imagen de propiedad" className="h-28 w-full object-cover" /> : <div className="h-28 bg-slate-100" />}<div className="space-y-2 p-2">{image.isPrimary ? <p className="text-xs font-bold text-emerald-700">Imagen principal</p> : <button type="button" disabled={saving} onClick={() => void updateImage(image, { isPrimary: true })} className="text-xs font-bold text-blue">Hacer principal</button>}<button type="button" disabled={saving} onClick={() => void deleteImage(image)} className="block text-xs font-bold text-red-700">Eliminar</button></div></div>)}</div></section> : null}
  </section>;
}
