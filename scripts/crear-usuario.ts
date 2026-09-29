import * as path from 'path';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno desde multiples ubicaciones
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/sri-backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERROR] SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Argumentos CLI permitidos (solo identificadores, nunca contrasenas)
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

const emailParam = getArg('--email') || process.env.VALWIS_ADMIN_EMAIL || 'admin@valwis.farmacia';
const nombreParam = getArg('--nombre') || process.env.VALWIS_ADMIN_NAME || 'Administrador Valwis';
const empresaParam = getArg('--empresa') || process.env.VALWIS_EMPRESA || 'Valwis';

// La contrasena se acepta EXCLUSIVAMENTE por variable de entorno
const rawPassword = process.env.VALWIS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

if (!rawPassword) {
  console.error('[ERROR] Contrasena no proporcionada. Defina la variable de entorno VALWIS_ADMIN_PASSWORD.');
  process.exit(1);
}

const passwordParam: string = rawPassword;

function validarComplejidadContrasena(password: string): boolean {
  if (password.length < 12) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

if (!validarComplejidadContrasena(passwordParam)) {
  console.error(
    '[ERROR] Politica de seguridad: la contrasena debe tener al menos 12 caracteres e incluir mayusculas, minusculas, numeros y caracteres especiales.'
  );
  process.exit(1);
}

export async function crearOUsuarioValwis() {
  console.log('===============================================================');
  console.log('  ALTA DE USUARIO Y EMPRESA VALWIS - UALDO NEGOCIOS            ');
  console.log('===============================================================\n');

  const email = emailParam.toLowerCase().trim();

  // 1. Obtener o crear empresa
  let { data: empresa, error: errEmpresa } = await supabase
    .from('empresas')
    .select('id, nombre')
    .ilike('nombre', empresaParam)
    .maybeSingle();

  if (errEmpresa) {
    console.error(`[ERROR] Al consultar empresa: ${errEmpresa.message}`);
    process.exit(1);
  }

  if (!empresa) {
    console.log(`[INFO] Registrando empresa '${empresaParam}'...`);
    const { data: nuevaEmpresa, error: errCrearEmp } = await supabase
      .from('empresas')
      .insert({ nombre: empresaParam, activo: true })
      .select('id, nombre')
      .single();

    if (errCrearEmp || !nuevaEmpresa) {
      console.error(`[ERROR] No se pudo crear la empresa: ${errCrearEmp?.message}`);
      process.exit(1);
    }
    empresa = nuevaEmpresa;
  }

  console.log(`[INFO] Empresa vinculada: ${empresa.nombre} (${empresa.id})`);

  // 2. Hash bcrypt con coste >= 10
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(passwordParam, saltRounds);

  // 3. Upsert usuario
  const { data: usuarioExistente } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (usuarioExistente) {
    const { error: errUpdate } = await supabase
      .from('usuarios')
      .update({
        empresa_id: empresa.id,
        nombre: nombreParam,
        password_hash: passwordHash,
        rol: 'admin',
        activo: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuarioExistente.id);

    if (errUpdate) {
      console.error(`[ERROR] Al actualizar usuario: ${errUpdate.message}`);
      process.exit(1);
    }
    console.log(`[INFO] Usuario actualizado exitosamente.`);
  } else {
    const { error: errInsert } = await supabase.from('usuarios').insert({
      empresa_id: empresa.id,
      email,
      nombre: nombreParam,
      password_hash: passwordHash,
      rol: 'admin',
      activo: true,
    });

    if (errInsert) {
      console.error(`[ERROR] Al crear usuario: ${errInsert.message}`);
      process.exit(1);
    }
    console.log(`[INFO] Usuario creado exitosamente.`);
  }

  console.log(`[INFO] Email: ${email}`);
  console.log(`[INFO] Rol: admin`);
  console.log(`[INFO] Estado: Activo\n`);
  console.log('Operacion completada con exito.');
}

if (require.main === module || process.argv[1]?.includes('crear-usuario')) {
  crearOUsuarioValwis().catch((err) => {
    console.error(`[ERROR CRITICO] ${err.message}`);
    process.exit(1);
  });
}
