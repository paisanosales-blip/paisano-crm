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

export type OpportunityStage = 'Prospect' | 'Qualification' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost';

export type Opportunity = {
  id: string;
  name: string;
  clientId: string;
  sellerId: string;
  stage: OpportunityStage;
  value: number;
  currency: 'USD' | 'MXN';
  closeDate: string;
};

export type Quotation = {
  id: string;
  opportunityId: string;
  clientId: string;
  sellerId: string;
  value: number;
  currency: 'USD' | 'MXN';
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
  version: number;
  pdfUrl?: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  entityId: string; // Could be clientId or opportunityId
  type: 'Call' | 'Email' | 'Meeting' | 'Note';
  notes: string;
  date: string;
  followUpDate?: string;
};
