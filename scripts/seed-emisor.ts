import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../apps/sri-backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en apps/sri-backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

interface EmisorConfigInput {
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  regimenRimpe?: string;
  ambiente: '1' | '2';
  establecimientoCodigo: string;
  puntoEmisionCodigo: string;
}

export async function configurarEmisor(config: EmisorConfigInput) {
  console.log('===============================================================');
  console.log('  CONFIGURACIÓN / SEED DE EMISOR Y PUNTOS DE EMISIÓN SRI       ');
  console.log('===============================================================\n');

  console.log(`RUC:                   ${config.ruc}`);
  console.log(`Razón Social:          ${config.razonSocial}`);
  console.log(`Nombre Comercial:      ${config.nombreComercial || '(Sin nombre comercial)'}`);
  console.log(`Dir. Matriz:           ${config.dirMatriz}`);
  console.log(`Dir. Establecimiento:  ${config.dirEstablecimiento}`);
  console.log(`Obligado Contabilidad: ${config.obligadoContabilidad}`);
  console.log(`Régimen RIMPE:         ${config.regimenRimpe || '(Régimen General)'}`);
  console.log(`Ambiente:              ${config.ambiente === '1' ? '1 (Pruebas)' : '2 (Producción)'}\n`);

  // 1. Upsert en tabla emisor
  const { data: emisorExistente, error: errConsulta } = await supabase
    .from('emisor')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (errConsulta) {
    console.error(`❌ Error consultando tabla emisor: ${errConsulta.message}`);
    process.exit(1);
  }

  const emisorPayload = {
    ruc: config.ruc,
    razon_social: config.razonSocial,
    nombre_comercial: config.nombreComercial || null,
    dir_matriz: config.dirMatriz,
    dir_establecimiento: config.dirEstablecimiento,
    contribuyente_especial: config.contribuyenteEspecial || null,
    obligado_contabilidad: config.obligadoContabilidad,
    regimen_rimpe: config.regimenRimpe || null,
    ambiente: config.ambiente,
    tipo_emision: '1',
    updated_at: new Date().toISOString(),
  };

  if (emisorExistente) {
    const { error: errUpd } = await supabase
      .from('emisor')
      .update(emisorPayload)
      .eq('id', emisorExistente.id);
    if (errUpd) throw errUpd;
    console.log(`✓ Registro de emisor actualizado en base de datos.`);
  } else {
    const { error: errIns } = await supabase.from('emisor').insert(emisorPayload);
    if (errIns) throw errIns;
    console.log(`✓ Registro de emisor insertado en base de datos.`);
  }

  // 2. Asegurar establecimiento
  const { error: errEstab } = await supabase
    .from('establecimientos')
    .upsert({
      codigo: config.establecimientoCodigo,
      nombre: `Establecimiento ${config.establecimientoCodigo}`,
      direccion: config.dirEstablecimiento,
      activo: true,
    }, { onConflict: 'codigo' });
  if (errEstab) throw errEstab;
  console.log(`✓ Establecimiento ${config.establecimientoCodigo} verificado.`);

  // 3. Asegurar punto de emisión
  const { error: errPto } = await supabase
    .from('puntos_emision')
    .upsert({
      establecimiento_codigo: config.establecimientoCodigo,
      codigo: config.puntoEmisionCodigo,
      nombre: `Caja ${config.puntoEmisionCodigo}`,
      activo: true,
    }, { onConflict: 'establecimiento_codigo,codigo' });
  if (errPto) throw errPto;
  console.log(`✓ Punto de emisión ${config.establecimientoCodigo}-${config.puntoEmisionCodigo} verificado.`);

  // 4. Inicializar secuenciales si no existen
  for (const tipoDoc of ['01', '04']) {
    const { error: errSec } = await supabase
      .from('secuenciales')
      .upsert({
        tipo_doc: tipoDoc,
        cod_establecimiento: config.establecimientoCodigo,
        cod_punto_emision: config.puntoEmisionCodigo,
      }, { onConflict: 'tipo_doc,cod_establecimiento,cod_punto_emision', ignoreDuplicates: true });
    if (errSec) console.warn(`Aviso en secuencial ${tipoDoc}: ${errSec.message}`);
  }
  console.log(`✓ Secuenciales (01 Factura, 04 Nota de Crédito) garantizados.`);

  console.log('\n✅ Configuración de emisor completada exitosamente.');
}

// Ejecución directa por CLI
if (require.main === module || process.argv[1]?.includes('seed-emisor')) {
  const ruc = process.env.SRI_RUC_EMISOR || '1790016919001';
  const razonSocial = process.env.SRI_RAZON_SOCIAL || 'FARMACIA PHARMASTOCK EXPRESS CIA. LTDA.';
  const nombreComercial = process.env.SRI_NOMBRE_COMERCIAL || 'PHARMASTOCK EXPRESS';
  const dirMatriz = process.env.SRI_DIR_MATRIZ || 'Av. Amazonas N24-15 y Colón, Quito';
  const dirEstablecimiento = process.env.SRI_DIR_ESTABLECIMIENTO || 'Av. Amazonas N24-15 y Colón, Quito';
  const obligadoContabilidad = (process.env.SRI_OBLIGADO_CONTABILIDAD as 'SI' | 'NO') || 'SI';
  const regimenRimpe = process.env.SRI_REGIMEN_RIMPE || 'CONTRIBUYENTE RÉGIMEN RIMPE';
  const ambiente = (process.env.SRI_AMBIENTE as '1' | '2') || '1';

  configurarEmisor({
    ruc,
    razonSocial,
    nombreComercial,
    dirMatriz,
    dirEstablecimiento,
    obligadoContabilidad,
    regimenRimpe,
    ambiente,
    establecimientoCodigo: '001',
    puntoEmisionCodigo: '001',
  }).catch((err) => {
    console.error('❌ Error configurando emisor:', err.message);
    process.exit(1);
  });
}
