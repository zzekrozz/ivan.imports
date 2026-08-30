const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;

function latin(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2013\u2014]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\x7e]/g, "?");
}

function escapePdf(value) {
  return latin(value).replace(/([\\()])/g, "\\$1");
}

function wrap(text, max = 88) {
  const words = latin(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) { lines.push(line); line = word; }
    else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

class ReportCanvas {
  constructor(report) { this.report = report; this.pages = []; this.page = null; this.y = 0; }
  startPage(title = null) {
    this.page = [];
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
    this.rect(0, PAGE_HEIGHT - 20, PAGE_WIDTH, 20, "203B57");
    if (title) { this.text("IVI", MARGIN, this.y, 11, "bold", "2F5FA4"); this.text(title, MARGIN + 34, this.y, 9, "regular", "5D686D"); this.y -= 25; }
  }
  ensure(height = 40, title = "IVI Vehicle Report") { if (!this.page || this.y - height < 55) this.startPage(title); }
  text(value, x, y, size = 10, weight = "regular", color = "152026") {
    const font = weight === "bold" ? "F2" : "F1";
    const [r, g, b] = color.match(/../g).map((part) => parseInt(part, 16) / 255);
    this.page.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`);
  }
  rect(x, y, width, height, color) {
    const [r, g, b] = color.match(/../g).map((part) => parseInt(part, 16) / 255);
    this.page.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x} ${y} ${width} ${height} re f`);
  }
  paragraph(value, { size = 10, color = "24333B", gap = 5, max = 88, bullet = false } = {}) {
    const lines = wrap(value, max);
    this.ensure(lines.length * (size + 4) + gap);
    lines.forEach((line, index) => { this.text(`${bullet && index === 0 ? "- " : bullet ? "  " : ""}${line}`, MARGIN, this.y, size, "regular", color); this.y -= size + 4; });
    this.y -= gap;
  }
  heading(value, level = 2) {
    const size = level === 1 ? 22 : 14;
    this.ensure(size + 24);
    this.text(value, MARGIN, this.y, size, "bold", level === 1 ? "152026" : "2F5FA4");
    this.y -= size + 12;
  }
  keyValue(label, value, status = null) {
    this.ensure(22);
    this.text(label.toUpperCase(), MARGIN, this.y, 7, "bold", "6B7780");
    this.text(value || "Pendiente de confirmacion", MARGIN + 155, this.y - 1, 10, "regular", value ? "152026" : "9A6A12");
    if (status) this.text(status, PAGE_WIDTH - MARGIN - 70, this.y, 7, "bold", "5D686D");
    this.y -= 21;
  }
  cover() {
    this.startPage();
    this.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F4F3EF");
    this.rect(0, PAGE_HEIGHT - 250, PAGE_WIDTH, 250, "152026");
    this.text("IVI", MARGIN, PAGE_HEIGHT - 105, 54, "bold", "FFFFFF");
    this.text("IMPORTS VEHICLE INTELLIGENCE", MARGIN, PAGE_HEIGHT - 137, 13, "bold", "D8B85C");
    this.text("VEHICLE REPORT", MARGIN, PAGE_HEIGHT - 170, 11, "regular", "C8D2DA");
    const identity = [this.report.vehicle?.identity?.manufacturer?.value, this.report.vehicle?.identity?.model?.value, this.report.vehicle?.identity?.variant?.value].filter(Boolean).join(" ") || "Vehiculo pendiente de identificacion completa";
    this.text(identity, MARGIN, PAGE_HEIGHT - 315, 22, "bold", "152026");
    this.text(`Informe ${this.report.id}`, MARGIN, PAGE_HEIGHT - 350, 11, "regular", "5D686D");
    const maskedVin = `${this.report.inputs.vin.slice(0, 3)}***********${this.report.inputs.vin.slice(-3)}`;
    this.keyValue("VIN protegido", maskedVin);
    this.keyValue("Pais de compra", this.report.inputs.purchaseCountry);
    this.keyValue("Kilometraje", `${Number(this.report.inputs.mileageKm).toLocaleString("es-ES")} km`);
    this.keyValue("Precio", `${Number(this.report.inputs.purchasePrice).toLocaleString("es-ES")} ${this.report.inputs.currency}`);
    this.keyValue("Fecha del informe", new Date(this.report.createdAt).toLocaleDateString("es-ES"));
    this.y = 95;
    this.text("Esto sabemos. Esto falta. Esto debes comprobar antes de pagar.", MARGIN, this.y, 10, "bold", "2F5FA4");
  }
  render() {
    this.cover();
    this.startPage("Resumen ejecutivo");
    this.heading("Veredicto IVI", 1);
    this.paragraph(this.report.verdict?.label || "Informacion pendiente", { size: 16, color: "152026" });
    this.paragraph("El veredicto no es una garantia de matriculacion. Resume la evidencia disponible y separa los hechos de lo que requiere comprobacion.");
    this.heading("Identificacion");
    const identity = this.report.vehicle?.identity || {};
    for (const [label, item] of [["Marca", identity.manufacturer], ["Modelo", identity.model], ["Version", identity.variant], ["Carroceria", identity.bodyType], ["Ano modelo", identity.modelYear]]) this.keyValue(label, item?.value, item?.status);
    this.heading("Configuracion de fabrica");
    const factory = this.report.vehicle?.factory || {};
    const technical = this.report.vehicle?.technical || {};
    for (const [label, item] of [["Fabricacion", factory.manufacturedDate], ["Color", factory.colour], ["Interior", factory.interiorTrim], ["Motor", technical.engine], ["Cambio", technical.transmission], ["Traccion", technical.drivetrain], ["Llantas", technical.wheels]]) this.keyValue(label, item?.value, item?.status);
    this.heading("Equipamiento destacado");
    const highlights = this.report.vehicle?.equipment?.highlights || [];
    if (highlights.length) highlights.forEach((item) => this.paragraph(item, { bullet: true })); else this.paragraph("No hay elementos destacados confirmados en la respuesta disponible.");
    this.heading("Homologacion y emisiones");
    this.keyValue("Homologacion", this.report.vehicle?.homologation?.status === "likely" ? "Probablemente compatible; revisar documentos" : "No confirmada automaticamente");
    this.keyValue("CO2", this.report.vehicle?.emissions?.co2?.value ? `${this.report.vehicle.emissions.co2.value} g/km` : null);
    this.heading("Riesgos y comprobaciones");
    for (const item of this.report.findings || []) {
      this.ensure(70);
      this.text(`[${item.severity}] ${item.title}`, MARGIN, this.y, 11, "bold", item.severity === "WARNING" || item.severity === "CRITICAL" ? "A23A32" : "2F5FA4");
      this.y -= 16;
      this.paragraph(item.explanation, { size: 9, gap: 2 });
      this.paragraph(`Recomendacion: ${item.recommendation}`, { size: 9, color: "5D686D", gap: 8 });
    }
    this.heading("Costes para Espana");
    for (const item of this.report.registration?.items || []) this.keyValue(item.label, item.amount === null ? null : `${item.amount.toLocaleString("es-ES")} ${item.currency}`, item.status);
    this.heading("Informacion pendiente");
    for (const item of this.report.missingInformation || []) this.paragraph(item, { bullet: true });
    this.heading("Preguntas para el vendedor");
    for (const question of this.report.sellerQuestions || []) this.paragraph(question, { bullet: true });
    this.heading("Fuentes y metodologia");
    this.paragraph("Configuracion de fabrica: One Auto API, OE Build Sheet Europe. Interpretacion: reglas conservadoras de IvanImports. Los campos ausentes se mantienen como desconocidos; ausencia no significa negacion.");
    this.heading("Conclusion IVI");
    this.paragraph(this.report.verdict?.label || "Informacion pendiente", { size: 14, color: "2F5FA4" });
    this.paragraph("Antes de comprar, contrasta VIN, CoC, documentacion extranjera, reformas y emisiones. Este informe no sustituye una inspeccion, una tasacion ni la resolucion de ITV, DGT o Hacienda.");
    return buildPdf(this.pages, this.report.id);
  }
}

function buildPdf(pages, reportId) {
  const objects = [];
  const add = (value) => { objects.push(value); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const regularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds = [];
  pages.forEach((commands, index) => {
    commands.push(`0.45 0.49 0.52 rg BT /F1 7 Tf ${MARGIN} 28 Td (${escapePdf(reportId)} - ${index + 1}/${pages.length}) Tj ET`);
    const stream = commands.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let output = "%PDF-1.4\n%IVI\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, "latin1")); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output, "latin1");
}

export function generateIVIPdf(report) {
  return new ReportCanvas(report).render();
}
