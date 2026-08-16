type ContractPdfData = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number | string | null;
  purpose: string | null;
  paymentMethod: string | null;
  properties: { title: string; address: string };
  landlord: { fullName: string; nationalId: string | null };
  tenant: { fullName: string; nationalId: string | null };
};

function pdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(value);
}

function formatMoney(value: number | string | null) {
  if (value === null) return "Por definir";
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
}

function wrap(value: string, width = 84) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > width && line) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

export function createContractPdf(contract: ContractPdfData) {
  const lines = [
    `Contrato No. ${contract.id}`,
    "",
    `Estado: ${contract.status}`,
    `Propiedad: ${contract.properties.title}`,
    `Direccion: ${contract.properties.address}`,
    "",
    `Arrendador: ${contract.landlord.fullName}${contract.landlord.nationalId ? ` - C.I. ${contract.landlord.nationalId}` : ""}`,
    `Arrendatario: ${contract.tenant.fullName}${contract.tenant.nationalId ? ` - C.I. ${contract.tenant.nationalId}` : ""}`,
    "",
    `Inicio: ${formatDate(contract.startDate)}`,
    `Fin: ${formatDate(contract.endDate)}`,
    `Canon mensual acordado: ${formatMoney(contract.monthlyRent)}`,
    `Destino: ${contract.purpose || "Vivienda"}`,
    `Forma de pago: ${contract.paymentMethod || "Por definir entre las partes"}`,
    "",
    "Las partes reconocen los datos del presente contrato de arrendamiento registrado en Manta360.",
    "Este documento se genera a partir de la informacion contractual vigente.",
    "",
    "______________________________                 ______________________________",
    "ARRENDADOR                                      ARRENDATARIO",
    contract.landlord.fullName, contract.tenant.fullName,
  ].flatMap((line) => line ? wrap(line) : [""]);

  const commands = ["BT", "/F1 19 Tf", "50 795 Td", "(CONTRATO DE ARRENDAMIENTO) Tj", "/F1 10.5 Tf"];
  for (const line of lines) commands.push("0 -18 Td", `(${pdfText(line)}) Tj`);
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
