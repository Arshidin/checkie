export class CustomerResponseDto {
  id!: string;
  email!: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  billingAddress?: Record<string, any>;
  shippingAddress?: Record<string, any>;
  providerCustomerId?: string;
  createdAt!: string;
  updatedAt!: string;
  totalSpent?: number;
  paymentsCount?: number;
  subscriptionsCount?: number;
}

export class CustomerListResponseDto {
  customers!: CustomerResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
  hasMore!: boolean;
}

export class CustomerDetailResponseDto extends CustomerResponseDto {
  payments?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  subscriptions?: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  }[];
}
