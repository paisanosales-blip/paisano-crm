export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'manager' | 'seller';
};

export type Client = {
  id: string;
  numeroDeCliente: string;
  nombreDelCliente: string;
  region: string;
  sellerId: string;
  createdAt: string;
};

export type OpportunityStage = 'Primer contacto' | 'Envió de Información' | 'Envió de Cotización' | 'Negociación' | 'Cierre de venta' | 'Financiamiento Externo';

export type ClientClassification = 'PROSPECTO' | 'CLIENTE POTENCIAL' | 'CLIENTE' | 'FINANCIAMIENTO';

export const getClassification = (stage: OpportunityStage): ClientClassification => {
    if (stage === 'Primer contacto' || stage === 'Envió de Información') return 'PROSPECTO';
    if (stage === 'Envió de Cotización' || stage === 'Negociación') return 'CLIENTE POTENCIAL';
    if (stage === 'Cierre de venta') return 'CLIENTE';
    if (stage === 'Financiamiento Externo') return 'FINANCIAMIENTO';
    return 'PROSPECTO';
};

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
  createdDate?: string;
  sentPrices?: boolean;
  sentTechnicalInfo?: boolean;
  sentCompanyInfo?: boolean;
  sentMedia?: boolean;
  infoSentContactChannels?: string[];
  infoSentNotes?: string;
  infoSentDate?: string;
  acceptedPrice?: boolean;
  quotedFreight?: boolean;
  requestsDiscount?: boolean;
  negotiationNotes?: string;
  negotiationDate?: string;
  agreedDeliveryTime?: number;
  clientMadeDownPayment?: boolean;
  deliveryTimeConfirmed?: boolean;
  closingNotes?: string;
  closingDate?: string;
  financiamientoExternoNotes?: string;
  financiamientoExternoDate?: string;
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
  quotationId?: string;
  type: 'Llamada' | 'Correo' | 'Reunión' | 'Nota' | 'Mensaje';
  notes: string;
  date: string;
  followUpDate?: string;
};

export type Product = {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  description: string;
  price: number;
  currency: 'USD' | 'MXN';
  createdAt: string;
};
