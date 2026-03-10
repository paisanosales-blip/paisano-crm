export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string;
  role: 'manager' | 'seller';
};

export type ExternalSeller = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type Client = {
  id: string;
  numeroDeCliente: string;
  nombreDelCliente: string;
  region: string;
  sellerId: string;
  createdAt: string;
};

export type OpportunityStage = 'Primer contacto' | 'Envió de Información' | 'Envió de Cotización' | 'Negociación' | 'Cierre de venta' | 'Financiamiento Externo' | 'Descartado';

export type ClientClassification = 'PROSPECTO' | 'CLIENTE POTENCIAL' | 'CLIENTE' | 'FINANCIAMIENTO' | 'PERDIDO';

export const getClassification = (stage: OpportunityStage): ClientClassification => {
    if (stage === 'Primer contacto' || stage === 'Envió de Información') return 'PROSPECTO';
    if (stage === 'Envió de Cotización' || stage === 'Negociación') return 'CLIENTE POTENCIAL';
    if (stage === 'Cierre de venta') return 'CLIENTE';
    if (stage === 'Financiamiento Externo') return 'FINANCIAMIENTO';
    if (stage === 'Descartado') return 'PERDIDO';
    return 'PROSPECTO';
};

export const getBadgeClass = (classification: ClientClassification) => {
    switch (classification) {
        case 'PROSPECTO': return 'bg-gray-100/80 text-gray-800 border-gray-200 dark:bg-gray-800/40 dark:text-gray-200 dark:border-gray-700';
        case 'CLIENTE POTENCIAL': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/80 dark:text-blue-200 dark:border-blue-800';
        case 'CLIENTE': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/80 dark:text-green-200 dark:border-green-800';
        case 'FINANCIAMIENTO': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/80 dark:text-amber-200 dark:border-amber-800';
        case 'PERDIDO': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/80 dark:text-red-200 dark:border-red-800';
        default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/40 dark:text-gray-200 dark:border-gray-700';
    }
};

export const getCardClass = (classification: ClientClassification) => {
    switch (classification) {
        case 'PROSPECTO': return 'bg-gray-100/50 dark:bg-gray-800/30';
        case 'CLIENTE POTENCIAL': return 'bg-blue-100/70 dark:bg-blue-900/40';
        case 'CLIENTE': return 'bg-green-100/70 dark:bg-green-900/40';
        case 'FINANCIAMIENTO': return 'bg-amber-100/70 dark:bg-amber-900/40';
        case 'PERDIDO': return 'bg-red-100/70 dark:bg-red-900/40';
        default: return 'bg-gray-100/50 dark:bg-gray-800/30';
    }
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
  discardedDate?: string;
  discardReason?: string;
  financingStatus?: 'Pendiente' | 'Aprobado';
};

export type Quotation = {
  id: string;
  opportunityId: string;
  sellerId: string;
  sellerName: string;
  value: number;
  currency: 'USD' | 'MXN';
  status: 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada';
  version: string;
  pdfUrl: string;
  createdDate: string;
  vins?: string;
};

export type Activity = {
  id: string;
  leadId: string;
  quotationId?: string;
  sellerId: string;
  sellerName: string;
  type: 'Llamada' | 'Correo' | 'Reunión' | 'Nota' | 'Mensaje' | 'Mensaje de Texto';
  description: string;
  contactChannels?: string[];
  dueDate?: string;
  completed: boolean;
  createdDate: string;
  completedDate?: string;
  clientResponded?: boolean;
  completionNotes?: string;
};

export type Product = {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  description: string;
  summary?: string;
  price: number;
  currency: 'USD' | 'MXN';
  createdAt: string;
};

export type Template = {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  subject?: string;
  content: string;
  type: 'Email' | 'WhatsApp' | 'SMS';
  createdAt: string;
};

export type MarketingTask = {
  description: string;
  points: number;
};

export type DailyPlan = {
  day: string;
  theme: string;
  tasks: MarketingTask[];
};

export type MarketingPlan = {
  id: string;
  code: string;
  createdAt: string;
  weekNumber: number;
  planData: { weeklyPlan: DailyPlan[] };
};

export interface TaskCompletionData {
  title: string;
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

export type CompletedMarketingTask = TaskCompletionData & {
  id: string;
  planId: string;
  userId: string;
  userName: string;
  taskDescription: string;
  points: number;
  completedAt: string;
  reviewStatus: 'Pendiente' | 'Aprobado' | 'Requiere Cambios';
  reviewFeedback?: string;
};

export type SharedFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedByUserId: string;
  uploadedByUserName: string;
  createdAt: string;
  description?: string;
};

export type ServiceTicket = {
  id: string;
  vin: string;
  incidentCause: string;
  usageTime: string;
  purchaseMethod: 'Directo' | 'Dealer';
  purchaseSource: string;
  isWarranty: boolean;
  status: 'Abierto' | 'En Progreso' | 'Solucionado' | 'Cerrado';
  reportedAt: string;
  solvedAt?: string;
  lastInteractionAt?: string;
  assignedAgentId: string;
  assignedAgentName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
};

export type ServiceInteraction = {
  id: string;
  ticketId: string;
  agentId: string;
  agentName: string;
  comment: string;
  createdAt: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
};

export type Sale = {
  id: string;
  leadId: string;
  clientName: string;
  sellerId: string;
  sellerName: string;
  units: number;
  pricePerUnit: number;
  currency: 'USD' | 'MXN';
  saleDate: string;
  paid: boolean;
  paidDate?: string | null;
  commissionType?: 'VENTA_PROPIA' | 'VENTA_EXTERNA' | 'VENTA_FINANCIADA';
  commissionAmount?: number;
  productType?: 'DUMP' | 'TANK WATTER' | 'SAND HOPPER' | 'OTHER';
  exchangeRate?: number;
  commissionStatus?: 'Pendiente' | 'Pagada';
};

export type CommissionPayment = {
  id: string;
  sellerId: string;
  date: string;
  paidSaleIds: string[];
  totalAmountUSD: number;
  totalAmountMXN: number;
};
