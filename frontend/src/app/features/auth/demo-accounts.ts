export interface DemoAccount {
  label: string;
  description: string;
  email: string;
  password: string;
}

/** Cuentas del seed del demo público (las mismas credenciales están documentadas en el README). */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    label: 'Paciente',
    description: 'Reserva y cancela citas desde «Mis citas».',
    email: 'paula.herrera@example.com',
    password: 'Paciente-Demo-2026',
  },
  {
    label: 'Administración',
    description: 'Gestiona agenda, noticias y profesionales.',
    email: 'admin@meridiana.example',
    password: 'Admin-Demo-2026',
  },
];
