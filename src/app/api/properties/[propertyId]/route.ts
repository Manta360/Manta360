import { NextResponse } from "next/server";
import { Prisma, PropertyStatus } from "@prisma/client";
import { getActiveSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { ownedPropertyInclude, serializeOwnedProperty } from "@/lib/owned-property";
import { serializeMineProperty } from "@/lib/owned-property-pg";
import { propertiesRepository } from "@/repositories/properties.server";
import {
  propertyCatalogSlug,
  propertyUpdateSchema,
  uniquePropertyLabels,
} from "@/lib/property-validation";
import { PROPERTY_IMAGES_BUCKET, removeStorageFile } from "@/lib/supabase/storage";
import { activeContractStatuses, isContractTransactionConflict, runContractTransaction } from "@/lib/contract-exclusivity";
import { propertyHasEffectiveContract } from "@/lib/property-contract-state";

type RouteContext = { params: Promise<{ propertyId: string }> };

const landlordStatuses: Set<PropertyStatus> = new Set([PropertyStatus.DISPONIBLE, PropertyStatus.MANTENIMIENTO]);

async function getOwnedProperty(propertyId: string, landlordId: string) {
  return prisma.properties.findFirst({
    where: { id: propertyId, landlordId },
    include: ownedPropertyInclude,
  });
}

async function requireLandlord() {
  const session = await getActiveSession();
  if (!session) return { error: NextResponse.json({ error: "SesiÃ³n requerida" }, { status: 401 }) };
  if (session.role !== "ARRENDADOR") return { error: NextResponse.json({ error: "OperaciÃ³n no permitida" }, { status: 403 }) };
  return { session };
}

async function catalogEntries(
  tx: Prisma.TransactionClient,
  names: string[],
  kind: "service" | "amenity",
) {
  return Promise.all(names.map((name) => {
    const slug = `${propertyCatalogSlug(name)}-${Date.now().toString(36)}`.slice(0, 120);
    return kind === "service"
      ? tx.service_catalog.upsert({ where: { name }, create: { name, slug }, update: { active: true } })
      : tx.amenity_catalog.upsert({ where: { name }, create: { name, slug }, update: { active: true } });
  }));
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
  if (property.status === PropertyStatus.INHABILITADO) {
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
      if (!landlordStatuses.has(data.status as PropertyStatus)) {
        return NextResponse.json({ error: "El Arrendador solo puede cambiar entre DISPONIBLE y MANTENIMIENTO" }, { status: 400 });
      }
      if (!landlordStatuses.has(property.status)) {
        return NextResponse.json({ error: "El estado actual solo puede cambiarse mediante el flujo de contratos o Municipio" }, { status: 409 });
      }
      if (data.status === property.status) return NextResponse.json({ error: "La propiedad ya tiene ese estado" }, { status: 409 });

      const activeContracts = await prisma.contracts.count({
        where: { propertyId, status: { in: [...activeContractStatuses] } },
      });
      if (activeContracts > 0) return NextResponse.json({ error: "No puedes cambiar el estado mientras exista un contrato activo" }, { status: 409 });

      const updated = await runContractTransaction(async (tx) => {
        const current = await tx.properties.findFirst({
          where: { id: property.id, landlordId: authorization.session.sub },
          select: { id: true, status: true },
        });
        if (!current || !landlordStatuses.has(current.status) || current.status === data.status) return null;
        if (await propertyHasEffectiveContract(tx, property.id)) return null;
        return tx.properties.update({
          where: { id: property.id },
          data: { status: data.status as PropertyStatus, updatedAt: new Date() },
          include: ownedPropertyInclude,
        });
      });
      if (!updated) return NextResponse.json({ error: "No puedes cambiar el estado mientras exista un contrato efectivo" }, { status: 409 });
      return NextResponse.json({ property: await serializeOwnedProperty(updated) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Prisma.propertiesUpdateInput = { updatedAt: new Date() };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.monthlyRent !== undefined) updateData.monthlyRent = new Prisma.Decimal(data.monthlyRent);
      if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms;
      if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.latitude !== undefined) updateData.latitude = new Prisma.Decimal(data.latitude);
      if (data.longitude !== undefined) updateData.longitude = new Prisma.Decimal(data.longitude);

      if (data.services !== undefined) {
        const services = await catalogEntries(tx, uniquePropertyLabels(data.services), "service");
        updateData.property_services = {
          deleteMany: {},
          create: services.map(({ id }) => ({ serviceId: id })),
        };
      }
      if (data.amenities !== undefined) {
        const amenities = await catalogEntries(tx, uniquePropertyLabels(data.amenities), "amenity");
        updateData.property_amenities = {
          deleteMany: {},
          create: amenities.map(({ id }) => ({ amenityId: id })),
        };
      }
      return tx.properties.update({ where: { id: property.id }, data: updateData, include: ownedPropertyInclude });
    });
    return NextResponse.json({ property: await serializeOwnedProperty(updated) });
  } catch (error) {
    if (isContractTransactionConflict(error)) {
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
  const property = await prisma.properties.findFirst({
    where: { id: propertyId, landlordId: authorization.session.sub },
    select: { id: true, status: true, property_images: { select: { id: true, storagePath: true } } },
  });
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  if (property.status === PropertyStatus.INHABILITADO) {
    return NextResponse.json({ error: "La propiedad fue inhabilitada por el Municipio y no puede eliminarse" }, { status: 409 });
  }

  const [activeContracts, contracts, requests, incidents, messages] = await Promise.all([
    prisma.contracts.count({ where: { propertyId, status: { in: [...activeContractStatuses] } } }),
    prisma.contracts.count({ where: { propertyId } }),
    prisma.contract_requests.count({ where: { propertyId } }),
    prisma.incident_reports.count({ where: { propertyId } }),
    prisma.chat_messages.count({ where: { propertyId } }),
  ]);
  if (activeContracts > 0) return NextResponse.json({ error: "No puedes eliminar una propiedad con contrato activo" }, { status: 409 });
  if (contracts > 0 || requests > 0 || incidents > 0 || messages > 0) {
    return NextResponse.json({ error: "La propiedad posee historial relacionado y no puede eliminarse de forma segura" }, { status: 409 });
  }

  try {
    await Promise.all(property.property_images.map((image) => removeStorageFile(PROPERTY_IMAGES_BUCKET, image.storagePath)));
    await prisma.$transaction([
      prisma.property_images.deleteMany({ where: { propertyId } }),
      prisma.properties.delete({ where: { id: property.id } }),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("owned property delete error", error);
    return NextResponse.json({ error: "No se pudo eliminar la propiedad de forma segura" }, { status: 500 });
  }
}
