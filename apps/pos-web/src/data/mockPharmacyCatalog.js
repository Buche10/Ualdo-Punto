// Catálogo precargado de medicamentos de farmacia con soporte para Cajas Completas, Unidades por Caja y Precio por Unidad

export const INITIAL_PRODUCTS = [
  {
    id: "prod-1",
    barcode: "7791234567890",
    name: "Ibuprofeno 600mg",
    activeIngredient: "Ibuprofeno",
    presentation: "Caja x 20 comprimidos",
    category: "Analgésico / Antiinflamatorio",
    unitsPerBox: 20,
    boxPrice: 4500,
    unitPrice: 250,
    boxCost: 2800,
    unitCost: 140,
    theoreticalStock: 45,
    countedStock: 0,
    isAudited: false,
    minStock: 20,
    location: "Estante A-1"
  },
  {
    id: "prod-2",
    barcode: "7798765432109",
    name: "Paracetamol 500mg",
    activeIngredient: "Paracetamol",
    presentation: "Caja x 16 tabletas",
    category: "Analgésico / Antipirético",
    unitsPerBox: 16,
    boxPrice: 3200,
    unitPrice: 220,
    boxCost: 1900,
    unitCost: 120,
    theoreticalStock: 64,
    countedStock: 0,
    isAudited: false,
    minStock: 16,
    location: "Estante A-2"
  },
  {
    id: "prod-3",
    barcode: "7790001112223",
    name: "Amoxicilina 500mg",
    activeIngredient: "Amoxicilina",
    presentation: "Caja x 14 cápsulas",
    category: "Antibiótico",
    unitsPerBox: 14,
    boxPrice: 8900,
    unitPrice: 700,
    boxCost: 5400,
    unitCost: 390,
    theoreticalStock: 28,
    countedStock: 0,
    isAudited: false,
    minStock: 14,
    location: "Estante B-1"
  },
  {
    id: "prod-4",
    barcode: "7793334445556",
    name: "Omeprazol 20mg",
    activeIngredient: "Omeprazol",
    presentation: "Caja x 28 cápsulas",
    category: "Gastroprotector",
    unitsPerBox: 28,
    boxPrice: 6800,
    unitPrice: 270,
    boxCost: 4100,
    unitCost: 150,
    theoreticalStock: 30,
    countedStock: 0,
    isAudited: false,
    minStock: 14,
    location: "Estante B-3"
  },
  {
    id: "prod-5",
    barcode: "7796667778889",
    name: "Losartán 50mg",
    activeIngredient: "Losartán Potásico",
    presentation: "Caja x 30 comprimidos",
    category: "Antihipertensivo",
    unitsPerBox: 30,
    boxPrice: 7500,
    unitPrice: 280,
    boxCost: 4600,
    unitCost: 160,
    theoreticalStock: 45,
    countedStock: 0,
    isAudited: false,
    minStock: 30,
    location: "Estante C-2"
  },
  {
    id: "prod-6",
    barcode: "7799990001112",
    name: "Azitromicina 500mg",
    activeIngredient: "Azitromicina",
    presentation: "Caja x 3 comprimidos",
    category: "Antibiótico",
    unitsPerBox: 3,
    boxPrice: 9200,
    unitPrice: 3200,
    boxCost: 6100,
    unitCost: 2100,
    theoreticalStock: 9,
    countedStock: 0,
    isAudited: false,
    minStock: 6,
    location: "Estante B-2"
  },
  {
    id: "prod-7",
    barcode: "7792223334445",
    name: "Loratadina 10mg",
    activeIngredient: "Loratadina",
    presentation: "Caja x 10 tabletas",
    category: "Antihistamínico",
    unitsPerBox: 10,
    boxPrice: 3900,
    unitPrice: 420,
    boxCost: 2300,
    unitCost: 240,
    theoreticalStock: 40,
    countedStock: 0,
    isAudited: false,
    minStock: 10,
    location: "Estante D-1"
  },
  {
    id: "prod-8",
    barcode: "7795556667778",
    name: "Metformina 850mg",
    activeIngredient: "Metformina Clorhidrato",
    presentation: "Caja x 60 comprimidos",
    category: "Antidiabético",
    unitsPerBox: 60,
    boxPrice: 8400,
    unitPrice: 150,
    boxCost: 5100,
    unitCost: 90,
    theoreticalStock: 120,
    countedStock: 0,
    isAudited: false,
    minStock: 30,
    location: "Estante C-4"
  },
  {
    id: "prod-9",
    barcode: "7798889990001",
    name: "Salbutamol Aerosol 100mcg",
    activeIngredient: "Salbutamol",
    presentation: "Frasco inalador x 1 dosis",
    category: "Broncodilatador",
    unitsPerBox: 1,
    boxPrice: 11500,
    unitPrice: 11500,
    boxCost: 7800,
    unitCost: 7800,
    theoreticalStock: 12,
    countedStock: 0,
    isAudited: false,
    minStock: 5,
    location: "Estante E-1"
  },
  {
    id: "prod-10",
    barcode: "7791112223334",
    name: "Alcohol Etílico 70%",
    activeIngredient: "Alcohol 70°",
    presentation: "Botella x 500ml",
    category: "Material de Cura / Antiséptico",
    unitsPerBox: 1,
    boxPrice: 2500,
    unitPrice: 2500,
    boxCost: 1400,
    unitCost: 1400,
    theoreticalStock: 80,
    countedStock: 0,
    isAudited: false,
    minStock: 25,
    location: "Estante M-1"
  }
];

const today = new Date();
const formatDate = (daysOffset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

export const INITIAL_BATCHES = [
  { id: "batch-1", productId: "prod-1", batchNumber: "LOT-2025-A", expirationDate: formatDate(120), quantity: 30 },
  { id: "batch-2", productId: "prod-1", batchNumber: "LOT-2025-B", expirationDate: formatDate(25), quantity: 15 },
  { id: "batch-3", productId: "prod-2", batchNumber: "PAR-9981", expirationDate: formatDate(360), quantity: 64 },
  { id: "batch-4", productId: "prod-3", batchNumber: "AMX-7740", expirationDate: formatDate(15), quantity: 14 },
  { id: "batch-5", productId: "prod-3", batchNumber: "AMX-8855", expirationDate: formatDate(200), quantity: 14 },
  { id: "batch-6", productId: "prod-4", batchNumber: "OMP-1120", expirationDate: formatDate(-10), quantity: 5 },
  { id: "batch-7", productId: "prod-4", batchNumber: "OMP-1121", expirationDate: formatDate(180), quantity: 25 },
  { id: "batch-8", productId: "prod-5", batchNumber: "LOS-4450", expirationDate: formatDate(45), quantity: 45 },
  { id: "batch-9", productId: "prod-6", batchNumber: "AZT-3321", expirationDate: formatDate(90), quantity: 9 },
  { id: "batch-10", productId: "prod-10", batchNumber: "ALC-7070", expirationDate: formatDate(500), quantity: 80 }
];

/**
 * Función auxiliar para formatear la cantidad total en un texto legible de Cajas y Unidades
 * Soporta números positivos y negativos (diferencias de auditoría).
 */
export const formatStockText = (totalUnits, unitsPerBox = 1) => {
  if (totalUnits === undefined || totalUnits === null || isNaN(totalUnits)) return '0 un.';
  
  const isNegative = totalUnits < 0;
  const absUnits = Math.abs(totalUnits);
  const upb = unitsPerBox > 0 ? unitsPerBox : 1;

  if (upb <= 1) {
    return isNegative ? `-${absUnits} un.` : `${absUnits} un.`;
  }

  const boxes = Math.floor(absUnits / upb);
  const loose = absUnits % upb;
  const prefix = isNegative ? '-' : '';

  if (boxes > 0 && loose > 0) {
    return `${prefix}${boxes} caj. y ${prefix}${loose} un. (${prefix}${absUnits} total)`;
  } else if (boxes > 0) {
    return `${prefix}${boxes} caja${boxes > 1 ? 's' : ''} (${prefix}${absUnits} un.)`;
  } else {
    return `${prefix}${loose} un. suelta${loose !== 1 ? 's' : ''}`;
  }
};
