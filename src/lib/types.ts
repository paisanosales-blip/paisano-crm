export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'admin' | 'manager' | 'seller';
};

export type Client = {
  id: string;
  numeroDeCliente: string;
  nombreDelCliente: string;
  region: string;
  sellerId: string;
  createdAt: string;
};

export type OpportunityStage = 'Primer contacto' | 'Envió de Información' | 'Envió de Cotización' | 'Negociación' | 'Cierre de venta';

export type ClientClassification = 'PROSPECTO' | 'CLIENTE POTENCIAL' | 'CLIENTE';

export type Opportunity = {
  id: string;
  name: string;
  clientId: string;
  leadId?: string;
  sellerId: string;
  stage: OpportunityStage;
  value: number;
  currency: 'USD' | 'MXN';
  closeDate: string;
  sentPrices?: boolean;
  sentTechnicalInfo?: boolean;
  sentCompanyInfo?: boolean;
  sentMedia?: boolean;
};

export type Quotation = {
  id: string;
  opportunityId: string;
  clientId: string;
  sellerId: string;
  value: number;
  currency: 'USD' | 'MXN';
  status: 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada';
  version: number;
  pdfUrl?: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  entityId: string; // Could be clientId or opportunityId
  type: 'Llamada' | 'Correo' | 'Reunión' | 'Nota';
  notes: string;
  date: string;
  followUpDate?: string;
};
