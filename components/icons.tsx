import type { ComponentType } from 'react';
import {
  UtensilsCrossed, Car, Home as HomeIcon, ShoppingBag, HeartPulse, Gamepad2,
  BookOpen, PiggyBank, CreditCard, Briefcase, Package, Coffee,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import type { CatId } from '../lib/categoryMap';

const ICON_FOR_CAT: Record<CatId, ComponentType<LucideProps>> = {
  food: UtensilsCrossed,
  transport: Car,
  housing: HomeIcon,
  shopping: ShoppingBag,
  health: HeartPulse,
  entertainment: Gamepad2,
  education: BookOpen,
  savings: PiggyBank,
  debt: CreditCard,
  income: Briefcase,
  other: Package,
};

// Convenience alias used by Add Transaction when picking icons by hand
export const CatIconAlias: Record<string, ComponentType<LucideProps>> = {
  cafe: Coffee,
  groceries: ShoppingBag,
  ...ICON_FOR_CAT,
};

export function CategoryIcon({
  cat,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.5,
}: {
  cat: CatId;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Cmp = ICON_FOR_CAT[cat] ?? Package;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
