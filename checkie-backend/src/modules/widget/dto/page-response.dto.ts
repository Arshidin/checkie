export class WidgetPageResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  description?: string;

  // Pricing
  pricingType!: string;
  price?: number;
  currency!: string;
  minPrice?: number;
  maxPrice?: number;
  suggestedPrice?: number;

  // Subscription
  subscriptionInterval?: string;
  subscriptionIntervalCount?: number;
  trialDays?: number;

  // Content
  headline?: string;
  subheadline?: string;
  buttonText!: string;
  imageUrl?: string;
  galleryImages!: string[];

  // Confirmation
  confirmationTitle?: string;
  confirmationMessage?: string;
  redirectUrl?: string;

  // Settings
  requireShipping!: boolean;
  allowCoupons!: boolean;

  // Design
  layoutType!: string;
  customCss?: string;

  // Store info
  store!: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };

  // Variants
  variants!: {
    id: string;
    name: string;
    displayOrder: number;
    isRequired: boolean;
    options: {
      id: string;
      name: string;
      priceModifier?: number;
      isDefault: boolean;
      displayOrder: number;
    }[];
  }[];

  // Custom fields
  customFields!: {
    id: string;
    name: string;
    label: string;
    type: string;
    placeholder?: string;
    helpText?: string;
    isRequired: boolean;
    displayOrder: number;
    options: string[];
    defaultValue?: string;
  }[];
}
