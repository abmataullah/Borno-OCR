export type PlanId = 'free' | 'pro' | 'business';
export type PaymentProvider = 'stripe' | 'bkash' | 'sslcommerz' | 'manual';

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  priceBdt: number;
  storageMb: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    priceBdt: 0,
    storageMb: 100,
    features: ['5 projects', 'Basic PDF editing', 'Text extraction', '100MB storage'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsd: 9,
    priceBdt: 900,
    storageMb: 5000,
    features: ['Unlimited projects', 'OCR (Bangla + English)', 'Table detection', '5GB storage', 'Export to DOCX/ODT', 'Priority support'],
  },
  business: {
    id: 'business',
    name: 'Business',
    priceUsd: 29,
    priceBdt: 2900,
    storageMb: 50000,
    features: ['Everything in Pro', '50GB storage', 'Team collaboration', 'API access', 'Custom branding', 'Dedicated support'],
  },
};

export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

export function getPlanByPrice(id: PlanId, currency: 'USD' | 'BDT'): number {
  return currency === 'USD' ? PLANS[id].priceUsd : PLANS[id].priceBdt;
}
