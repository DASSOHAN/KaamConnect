export type Language = 'en' | 'bn' | 'hi';

export type UserRole = 'customer' | 'worker' | 'admin';

export type ServiceCategoryId = 
  | 'electrician' 
  | 'plumber' 
  | 'carpenter' 
  | 'painter' 
  | 'cleaner' 
  | 'mason';

export interface ServiceTask {
  id: string;
  name: string;
  nameBn: string;
  nameHi: string;
  basePrice: number;
  estMinutes: number;
  description: string;
}

export interface ServiceCategory {
  id: ServiceCategoryId;
  name: string;
  nameBn: string;
  nameHi: string;
  iconName: string;
  tagline: string;
  fairWageRange: {
    min: number;
    max: number;
    unit: string;
    unitBn: string;
    unitHi: string;
  };
  typicalResponseTime: string;
  activeWorkersCount: number;
  popularTasks: ServiceTask[];
}

export interface WorkerReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  locality: string;
}

export interface Worker {
  id: string;
  name: string;
  nameBn: string;
  nameHi: string;
  phone: string;
  avatar: string;
  tradeId: ServiceCategoryId;
  tradeTitle: string;
  experienceYears: number;
  rating: number;
  completedJobs: number;
  languages: string[];
  kycVerified: boolean;
  aadhaarVerified: boolean;
  policeVerification: boolean;
  locality: string;
  distanceKm: number;
  dailyRate: number;
  halfDayRate: number;
  isAvailable: boolean;
  bio: string;
  skills: string[];
  recentReviews: WorkerReview[];
  todayEarnings?: number;
  todayJobsCount?: number;
}

export type BookingStatus = 
  | 'matching' 
  | 'en_route' 
  | 'arrived' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceId: ServiceCategoryId;
  serviceName: string;
  taskId: string;
  taskName: string;
  locality: string;
  addressDetails: string;
  bookingType: 'immediate' | 'scheduled';
  scheduledDate?: string;
  scheduledSlot?: string;
  estimatedPriceMin: number;
  estimatedPriceMax: number;
  finalPrice: number;
  status: BookingStatus;
  workerId?: string;
  worker?: Worker;
  createdAt: string;
  otp: string;
  paymentMethod: 'cash' | 'upi';
  notes?: string;
  rating?: number;
  tipAmount?: number;
  reviewComment?: string;
}

export interface IncomingJobRequest {
  id: string;
  serviceId: ServiceCategoryId;
  serviceTitle: string;
  taskTitle: string;
  locality: string;
  distanceKm: number;
  payoutAmount: number;
  customerName: string;
  timeRequested: string;
  expiresInSeconds: number;
  addressNote: string;
}

export interface KalyaniLocation {
  id: string;
  name: string;
  nameBn: string;
  nameHi: string;
  wardOrBlock: string;
  isPopular?: boolean;
}
