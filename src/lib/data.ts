import type { Client, Opportunity, Quotation, User, Activity } from './types';

export const users: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@paisano.com', avatarUrl: '1', role: 'admin' },
  { id: '2', name: 'Manager Garcia', email: 'manager@paisano.com', avatarUrl: '2', role: 'manager' },
  { id: '3', name: 'Seller Juan', email: 'juan@paisano.com', avatarUrl: '3', role: 'seller' },
  { id: '4', name: 'Seller Maria', email: 'maria@paisano.com', avatarUrl: '4', role: 'seller' },
];

export const clients: Client[] = [
  { id: '1', numeroDeCliente: 'C001', nombreDelCliente: 'Constructora Acme', region: 'Norte', sellerId: '3', createdAt: '2023-01-15' },
  { id: '2', numeroDeCliente: 'C002', nombreDelCliente: 'Industrias Stark', region: 'Centro', sellerId: '3', createdAt: '2023-02-20' },
  { id: '3', numeroDeCliente: 'C003', nombreDelCliente: 'Servicios Wayne', region: 'Sur', sellerId: '4', createdAt: '2023-03-10' },
  { id: '4', numeroDeCliente: 'C004', nombreDelCliente: 'Global Tech', region: 'Norte', sellerId: '4', createdAt: '2023-04-05' },
];

export const opportunities: Opportunity[] = [
  { id: '1', name: 'Project Alpha', clientId: '1', sellerId: '3', stage: 'Envió de Cotización', value: 50000, currency: 'USD', closeDate: '2024-08-30' },
  { id: '2', name: 'Project Beta', clientId: '2', sellerId: '3', stage: 'Envió de Información', value: 75000, currency: 'USD', closeDate: '2024-09-15' },
  { id: '3', name: 'Project Gamma', clientId: '3', sellerId: '4', stage: 'Negociación', value: 120000, currency: 'MXN', closeDate: '2024-07-25' },
  { id: '4', name: 'Project Delta', clientId: '4', sellerId: '4', stage: 'Cierre de venta', value: 90000, currency: 'USD', closeDate: '2024-06-01' },
  { id: '5', name: 'Project Epsilon', clientId: '1', sellerId: '3', stage: 'Primer contacto', value: 25000, currency: 'MXN', closeDate: '2024-10-10' },
  { id: '6', name: 'Project Zeta', clientId: '2', sellerId: '4', stage: 'Primer contacto', value: 60000, currency: 'USD', closeDate: '2024-05-20' },
];

export const quotations: Quotation[] = [
  { id: 'q1', opportunityId: '1', clientId: '1', sellerId: '3', value: 50000, currency: 'USD', status: 'Enviada', version: 2, createdAt: '2024-07-01' },
  { id: 'q2', opportunityId: '3', clientId: '3', sellerId: '4', value: 120000, currency: 'MXN', status: 'Enviada', version: 1, createdAt: '2024-06-20' },
  { id: 'q3', opportunityId: '4', clientId: '4', sellerId: '4', value: 90000, currency: 'USD', status: 'Aceptada', version: 1, createdAt: '2024-05-15' },
  { id: 'q4', opportunityId: '2', clientId: '2', sellerId: '3', value: 75000, currency: 'USD', status: 'Borrador', version: 1, createdAt: '2024-07-05' },
];

export const activities: Activity[] = [
  { id: 'a1', entityId: '1', type: 'Llamada', notes: 'Discussed initial requirements for Project Alpha.', date: '2024-06-15', followUpDate: '2024-07-22' },
  { id: 'a2', entityId: '1', type: 'Correo', notes: 'Sent follow-up email with brochure.', date: '2024-06-16' },
  { id: 'a3', entityId: '3', type: 'Reunión', notes: 'Met with stakeholders to negotiate terms.', date: '2024-06-18' },
  { id: 'a4', entityId: '1', type: 'Nota', notes: 'Client is concerned about budget.', date: '2024-07-02' },
];
