import { z } from 'zod';

// Validação de e-mail feita "na mão" (em vez de `.email()` do zod) para não
// depender de qual variante da API de formatos de string a versão do zod
// instalada expõe — a mesma regra usada no backend (`Domain/Email.cs`).
const email = z
  .string()
  .min(1, 'Informe seu e-mail.')
  .refine((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), 'E-mail inválido.');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe sua senha.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Informe seu nome.').max(200, 'Nome muito longo.'),
    email,
    phone: z.string().optional(),
    // Mesma regra do backend (AuthService.MinimumPasswordLength).
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
    role: z.enum(['Resident', 'Professional']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
