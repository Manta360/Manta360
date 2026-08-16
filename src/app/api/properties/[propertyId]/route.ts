import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/server-auth";
import { serializeMineProperty } from "@/lib/owned-property-pg";
import { propertiesRepository, runPropertiesTransaction } from "@/repositories/properties.server";
import { propertyUpdateSchema, uniquePropertyLabels } from "@/lib/property-validation";
import { PROPERTY_IMAGES_BUCKET, removeStorageFile } from "@/lib/supabase/storage";

type RouteContext = { params: Promise<{ propertyId: string }> };

const landlordStatuses = new Set(["DISPONIBLE", "MANTENIMIENTO"]);

async function getOwnedProperty(propertyId: string, landlordId: string) {
  return propertiesRepository.findMineById(propertyId, landlordId);
}

async function requireLandlord() {
  const session = await getActiveSession();
  if (!session) return { error: NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 }) };
  if (session.role !== "ARRENDADOR") return { error: NextResponse.json({ error: "OperaciÃ³n no permitida" }, { status: 403 }) };
  return { session };
}

export async function GET(_request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId } = await context.params;
  const property = await propertiesRepository.findMineById(propertyId, authorization.session.sub);
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  return NextResponse.json({ property: await serializeMineProperty(property) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId } = await context.params;
  const property = await getOwnedProperty(propertyId, authorization.session.sub);
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (property.status === "INHABILITADO") {
    return NextResponse.json({ error: "La propiedad fue inhabilitada por el Municipio y no puede modificarse" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invÃ¡lido" }, { status: 400 });
  }
  const parsed = propertyUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ActualizaciÃ³n invÃ¡lida", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const businessFields = Object.keys(data).filter((key) => key !== "status");
  if (data.status !== undefined && businessFields.length > 0) {
    return NextResponse.json({ error: "EnvÃ­a el cambio de estado separado de la ediciÃ³n de datos" }, { status: 400 });
  }

  try {
    if (data.status !== undefined) {
      if (!landlordStatuses.has(data.status)) {
        return NextResponse.json({ error: "El Arrendador solo puede cambiar entre DISPONIBLE y MANTENIMIENTO" }, { status: 400 });
      }
      if (!landlordStatuses.has(property.status)) {
        return NextResponse.json({ error: "El estado actual solo puede cambiarse mediante el flujo de contratos o Municipio" }, { status: 409 });
      }
      if (data.status === property.status) return NextResponse.json({ error: "La propiedad ya tiene ese estado" }, { status: 409 });

      const activeContracts = await propertiesRepository.countEffectiveContracts(propertyId);
      if (activeContracts > 0) return NextResponse.json({ error: "No puedes cambiar el estado mientras exista un contrato activo" }, { status: 409 });

      const nextStatus = data.status as "DISPONIBLE" | "MANTENIMIENTO";
      const changed = await runPropertiesTransaction((repository) => repository.changeLandlordStatus(property.id, authorization.session.sub, nextStatus));
      const updated = changed ? await propertiesRepository.findMineById(property.id, authorization.session.sub) : null;
      if (!updated) return NextResponse.json({ error: "No puedes cambiar el estado mientras exista un contrato efectivo" }, { status: 409 });
      return NextResponse.json({ property: await serializeMineProperty(updated) });
    }

    await runPropertiesTransaction((repository) => repository.updateOwnedProperty(property.id, authorization.session.sub, data, data.services === undefined ? undefined : uniquePropertyLabels(data.services), data.amenities === undefined ? undefined : uniquePropertyLabels(data.amenities)));
    const updated = await propertiesRepository.findMineById(property.id, authorization.session.sub);
    if (!updated) throw new Error("Propiedad no encontrada");
    return NextResponse.json({ property: await serializeMineProperty(updated) });
  } catch (error) {
    if ((error as { code?: string }).code === "40001" || (error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "La propiedad cambio durante la actualizacion" }, { status: 409 });
    }
    console.error("owned property update error", error);
    return NextResponse.json({ error: "No se pudo actualizar la propiedad" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authorization = await requireLandlord();
  if ("error" in authorization) return authorization.error!;
  const { propertyId } = await context.params;
  const property = await propertiesRepository.findOwnedForDeletion(propertyId, authorization.session.sub);
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (property.status === "INHABILITADO") {
    return NextResponse.json({ error: "La propiedad fue inhabilitada por el Municipio y no puede eliminarse" }, { status: 409 });
  }

  const history = await propertiesRepository.relatedHistoryCounts(propertyId);
  if (history.activeContracts > 0) return NextResponse.json({ error: "No puedes eliminar una propiedad con contrato activo" }, { status: 409 });
  if (history.contracts > 0 || history.requests > 0 || history.incidents > 0 || history.messages > 0) {
    return NextResponse.json({ error: "La propiedad posee historial relacionado y no puede eliminarse de forma segura" }, { status: 409 });
  }

  try {
    await Promise.all(property.images.map((image) => removeStorageFile(PROPERTY_IMAGES_BUCKET, image.storagePath)));
    await runPropertiesTransaction((repository) => repository.deleteProperty(property.id));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("owned property delete error", error);
    return NextResponse.json({ error: "No se pudo eliminar la propiedad de forma segura" }, { status: 500 });
  }
}
