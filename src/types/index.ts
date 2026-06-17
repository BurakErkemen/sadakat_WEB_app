import type { Timestamp } from 'firebase/firestore'

export interface UserProfile {
  displayName: string
  email: string
  phone?: string
  merchantId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Merchant {
  id: string
  name: string
  slug: string
  sector: string
  city: string
  district: string
  phone: string
  instagram?: string
  googleMapsUrl?: string
  logoUrl?: string
  brandColor?: string
  ownerId: string
  activeCampaignId?: string
  status: 'active' | 'passive'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PublicSlug {
  merchantId: string
  isActive: boolean
  createdAt: Timestamp
}

export interface Campaign {
  id: string
  name: string
  description: string
  type: 'stamp' | 'points'       // damga veya puan sistemi
  requiredStamps: number          // hedef damga/puan sayısı
  pointsPerUnit?: number          // puan modunda: 1 TL başına kaç puan (ör. 0.1 → 100TL=10p)
  rewardDescription: string
  status: 'active' | 'passive'
  startDate: Timestamp
  endDate?: Timestamp
  coverImageUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Customer {
  id: string
  fullName: string
  phone: string
  normalizedPhone: string
  note?: string | null
  consentAccepted: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Membership {
  id: string
  customerId: string
  campaignId: string
  cardToken: string
  currentStamps: number
  totalEarnedStamps: number
  totalRedeemedRewards: number
  status: 'active' | 'passive'
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Transaction {
  id: string
  customerId: string
  campaignId: string
  membershipId: string
  type: 'stamp_add' | 'reward_redeem' | 'manual_adjustment'
  amount: number
  purchaseAmount?: number        // puan modunda ödenen TL tutarı
  note?: string | null
  createdBy: string
  createdAt: Timestamp
}

export interface Subscription {
  plan: 'trial' | 'mini' | 'standard' | 'pro'
  status: 'active' | 'trialing' | 'past_due' | 'canceled'
  currentPeriodStart: Timestamp
  currentPeriodEnd: Timestamp
  updatedAt: Timestamp
}

export interface PublicCard {
  merchantId: string
  campaignId: string
  membershipId: string
  cardToken: string
  currentStamps: number
  status: 'active' | 'passive'
  customerDisplayName: string
  lastUpdatedAt: Timestamp
  createdAt: Timestamp
}

export interface SupportTicket {
  id: string
  merchantId: string
  merchantName: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'closed'
  adminReply?: string | null
  repliedAt?: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PricingPlan {
  id: string
  label: string
  price: number                  // TL/ay
  maxCustomers: number | -1      // -1 = sınırsız
  maxMonthlyTransactions: number | -1
  maxCampaigns: number | -1
  features: string[]
  isPopular?: boolean
  updatedAt: Timestamp
}
