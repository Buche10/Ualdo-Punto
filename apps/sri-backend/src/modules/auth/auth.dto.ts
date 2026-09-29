import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string()
    .email('Formato de correo electronico invalido')
    .transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, 'La contrasena es requerida'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string | null;
  rol: 'admin' | 'operador';
  empresa_id: string;
  empresa?: {
    id: string;
    nombre: string;
    ruc?: string | null;
  } | null;
}

export interface JwtPayload {
  sub: string;
  empresa_id: string;
  rol: string;
  iat?: number;
  exp?: number;
}
