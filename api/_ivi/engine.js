const FINDING_ORDER = Object.freeze({ CRITICAL: 0, WARNING: 1, CHECK: 2, INFO: 3 });

function finding(code, severity, title, explanation, recommendation, evidence = [], sellerQuestion = null) {
  return { code, severity, title, explanation, evidence: evidence.filter(Boolean), recommendation, sellerQuestion };
}

const MODIFICATION_RULES = Object.freeze({
  wheels: ["WHEEL_MODIFICATION_DECLARED", "CHECK", "Comprobar llantas y neumáticos", "Has indicado que las llantas actuales no son las originales.", "Comprueba medidas, índices y equivalencias admitidas o la homologación de la reforma.", "¿Qué medidas montan ahora las llantas y los neumáticos? ¿Aparecen admitidas en la documentación?"],
  suspension: ["SUSPENSION_MODIFICATION_DECLARED", "WARNING", "Suspensión modificada", "Una suspensión modificada puede requerir documentación de reforma para ITV.", "Pide la referencia de los componentes y la documentación de instalación y homologación.", "¿La suspensión es original? Si no, ¿tienes certificado, informe o anotación de la reforma?"],
  exhaust: ["EXHAUST_MODIFICATION_DECLARED", "WARNING", "Escape modificado", "El escape declarado podría afectar ruido, emisiones o la conformidad del vehículo.", "Confirma referencias, marcado y documentación antes de comprar.", "¿El escape es original? Si se sustituyó, ¿qué referencia lleva y qué documentación existe?"],
  lpg: ["LPG_MODIFICATION_DECLARED", "WARNING", "Instalación GLP declarada", "Una instalación GLP posterior necesita trazabilidad técnica y documental.", "Comprueba depósito, fecha, instalación y documentación de reforma.", "¿Cuándo y dónde se instaló el GLP? ¿Dispones de toda la documentación y revisiones?"],
  camper: ["CAMPER_MODIFICATION_DECLARED", "WARNING", "Camperización declarada", "La transformación puede afectar categoría, masas, plazas y homologación.", "Solicita proyecto, certificados y documentación actualizada.", "¿La camperización está anotada en la documentación y qué elementos fijos incluye?"],
  lighting: ["LIGHTING_MODIFICATION_DECLARED", "CHECK", "Iluminación modificada", "Cambios de ópticas o tecnología pueden requerir comprobación de compatibilidad y homologación.", "Verifica marcado, referencias y documentación.", "¿Qué elementos de iluminación se han cambiado y conservas las piezas o facturas?"],
  bodyKit: ["BODY_KIT_DECLARED", "CHECK", "Kit exterior declarado", "Algunos cambios exteriores alteran dimensiones o elementos homologados.", "Comprueba referencias y si la reforma figura documentada.", "¿El kit exterior es original de fábrica o posterior? ¿Existe documentación?"],
  power: ["POWER_MODIFICATION_DECLARED", "WARNING", "Aumento de potencia declarado", "Una reprogramación o cambio de potencia puede afectar emisiones, seguro y homologación.", "Pide factura, banco de potencia y documentación de legalización.", "¿Qué modificación de potencia se realizó y está reflejada en la documentación?"],
  other: ["OTHER_MODIFICATION_DECLARED", "CHECK", "Otras modificaciones declaradas", "Hay cambios actuales que todavía no podemos comparar con fábrica.", "Describe y documenta cada cambio antes de cerrar la compra.", "¿Puedes detallar todas las modificaciones y enviar su documentación?"],
});

export function buildFindings(vehicle, input) {
  const findings = [];
  if (vehicle?.homologation?.status === "not_confirmed") findings.push(finding(
    "HOMOLOGATION_NOT_CONFIRMED", "CHECK", "Homologación europea no confirmada",
    "La configuración de fábrica no aporta evidencia suficiente para confirmar automáticamente la homologación europea.",
    "Solicita el CoC y una imagen completa de la documentación extranjera antes de pagar.", [],
    "¿Puedes enviarme el CoC y fotografías completas de toda la documentación del vehículo?",
  ));
  if (vehicle?.emissions?.co2?.status !== "confirmed") findings.push(finding(
    "CO2_NOT_CONFIRMED", "CHECK", "CO₂ pendiente de confirmación",
    "El proveedor no ha devuelto un valor de CO₂ con trazabilidad suficiente. Sin él no calculamos el IEDMT.",
    "Confirma V.7 en la documentación o en el CoC mediante revisión documental.", [],
    "¿Puedes enviar una fotografía donde se vea el dato de CO₂ o el CoC completo?",
  ));
  if (input?.vinFormatWarning) findings.push(finding(
    "NON_STANDARD_VIN_FORMAT", "CHECK", "Formato VIN no estándar",
    "El identificador se ha aceptado, pero no tiene la longitud estándar de 17 caracteres.",
    "Contrasta el número grabado en el chasis con la documentación.", [input.vin],
    "¿Puedes enviar una foto legible del VIN en el chasis y en la documentación?",
  ));
  const towbar = input?.modifications?.towbar;
  const factoryTowbar = vehicle?.equipment?.relevant?.towbar;
  if (towbar === "yes" && factoryTowbar?.value !== true) findings.push(finding(
    "FACTORY_TOWBAR_NOT_CONFIRMED", "CHECK", "Comprobar bola de remolque",
    "Has indicado que lleva bola, pero no hemos podido confirmar que formara parte de la configuración original.",
    "Comprueba la placa, referencia y documentación de instalación antes de matricular.", factoryTowbar?.value === false ? ["El build sheet contiene una negación explícita de bola de fábrica."] : [],
    "¿La bola es original de fábrica o se instaló después? ¿Dispones de documentación?",
  ));
  if (towbar === "no" && factoryTowbar?.value === true) findings.push(finding(
    "FACTORY_TOWBAR_CURRENTLY_NOT_DECLARED", "CHECK", "Bola de fábrica no visible en el estado declarado",
    "La configuración de fábrica indica una bola, pero has declarado que el vehículo no la lleva actualmente.",
    "Comprueba si es desmontable, si se ha retirado y qué elementos o documentación se entregan con el vehículo.", ["Bola de remolque confirmada en la configuración de fábrica."],
    "La configuración de fábrica incluye bola de remolque. ¿Es desmontable o se ha retirado? ¿Se entrega completa?",
  ));
  for (const [key, rule] of Object.entries(MODIFICATION_RULES)) {
    if (input?.modifications?.[key] !== "yes") continue;
    findings.push(finding(rule[0], rule[1], rule[2], rule[3], rule[4], [], rule[5]));
  }
  if (!vehicle?.identity?.manufacturer?.value || !vehicle?.identity?.model?.value) findings.push(finding(
    "IDENTITY_PARTIAL", "INFO", "Identificación parcial",
    "La respuesta disponible no incluye marca y modelo completos.",
    "Contrasta el VIN y la denominación comercial con la documentación y el anuncio.", [],
    "¿Qué marca, modelo y versión figuran exactamente en la documentación?",
  ));
  if (findings.some((item) => ["CHECK", "WARNING", "CRITICAL"].includes(item.severity))) findings.push(finding(
    "DOCUMENT_REVIEW_RECOMMENDED", "INFO", "Revisión documental recomendada",
    "Una revisión de la documentación permite confirmar los puntos que una consulta automática no puede resolver.",
    "Solicita la revisión documental de IvanImports antes de cerrar una compra con dudas relevantes.",
  ));
  return findings.sort((a, b) => FINDING_ORDER[a.severity] - FINDING_ORDER[b.severity] || a.code.localeCompare(b.code));
}

export function buildSellerQuestions(findings) {
  return [...new Set((findings || []).map((item) => item.sellerQuestion).filter(Boolean))];
}

export function buildSpainCosts(input, vehicle) {
  const purchase = Number(input?.purchasePrice);
  const currency = input?.currency || "EUR";
  const co2Confirmed = vehicle?.emissions?.co2?.status === "confirmed";
  const items = [
    { code: "vehicle", label: "Precio del vehículo", amount: Number.isFinite(purchase) ? purchase : null, currency, status: "confirmed", explanation: "Importe declarado por el usuario." },
    { code: "transport", label: "Transporte / viaje", amount: null, currency: "EUR", status: "pending", explanation: "Faltan origen exacto y modalidad de traslado." },
    { code: "itv", label: "ITV de matriculación", amount: null, currency: "EUR", status: "pending", explanation: "La tarifa depende de estación, categoría y documentación." },
    { code: "iedmt", label: "IEDMT", amount: null, currency: "EUR", status: "pending", explanation: co2Confirmed ? "Falta base imponible fiscal y fecha para aplicar la regla vigente." : "No se calcula sin CO₂ confirmado y base imponible fiscal." },
    { code: "dgt", label: "DGT", amount: null, currency: "EUR", status: "pending", explanation: "Debe comprobarse la tasa oficial vigente al presentar el expediente." },
    { code: "ivtm", label: "IVTM", amount: null, currency: "EUR", status: "pending", explanation: "Depende del municipio y de la potencia fiscal." },
    { code: "technical", label: "CoC / ficha reducida", amount: null, currency: "EUR", status: "pending", explanation: "Depende de qué documentación exista y sea válida." },
  ];
  return { items, total: { amount: null, currency: "EUR", status: "pending", explanation: "El total queda pendiente hasta confirmar impuestos, documentación y logística." } };
}

export function buildMissingInformation(vehicle) {
  const missing = [];
  if (!vehicle?.identity?.manufacturer?.value) missing.push("Marca del vehículo");
  if (!vehicle?.identity?.model?.value) missing.push("Modelo y versión exactos");
  if (vehicle?.homologation?.status !== "confirmed") missing.push("Homologación europea y CoC");
  if (vehicle?.emissions?.co2?.status !== "confirmed") missing.push("CO₂ homologado (V.7)");
  if (!vehicle?.technical?.powerKw?.value) missing.push("Potencia homologada");
  return missing;
}

export function verdictFor(findings) {
  const severities = new Set((findings || []).map((item) => item.severity));
  if (severities.has("CRITICAL")) return { level: "critical", label: "Riesgo importante detectado" };
  if (severities.has("WARNING")) return { level: "warning", label: "Revisar antes de comprar" };
  if (severities.has("CHECK")) return { level: "pending", label: "Información pendiente" };
  return { level: "clear", label: "Sin bloqueantes evidentes" };
}

export function enrichReport(report) {
  const findings = buildFindings(report.vehicle, report.inputs);
  return {
    ...report,
    findings,
    missingInformation: buildMissingInformation(report.vehicle),
    sellerQuestions: buildSellerQuestions(findings),
    registration: buildSpainCosts(report.inputs, report.vehicle),
    verdict: verdictFor(findings),
  };
}
