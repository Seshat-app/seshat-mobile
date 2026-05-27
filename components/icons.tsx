import type { ComponentType } from 'react';
import {
  UtensilsCrossed, Car, Home as HomeIcon, ShoppingBag, HeartPulse, Gamepad2,
  BookOpen, PiggyBank, CreditCard, Briefcase, Package, Coffee,
  Sparkles, Repeat, Plane, Gift, Dumbbell, Cat as PawPrint, Baby, Smartphone,
  Wifi, Wrench, Receipt, Music, Camera, Tv, Shirt, Flower, Cigarette, Wine,
  Fuel, Bus, Bike, Hammer, Scissors,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import type { CatId } from '../lib/categoryMap';

// All icons available for categories — both the canonical defaults and the
// extras users can pick when creating a custom category. Key is a stable
// string we persist server-side (Category.icon).
export const CATEGORY_ICON_REGISTRY: Record<string, ComponentType<LucideProps>> = {
  // Default-category icons (mapped from canonical CatIds)
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
  // Extras — common custom-category use-cases
  coffee: Coffee,
  beauty: Sparkles,
  subscription: Repeat,
  travel: Plane,
  gift: Gift,
  fitness: Dumbbell,
  pets: PawPrint,
  kids: Baby,
  phone: Smartphone,
  internet: Wifi,
  utility: Wrench,
  bill: Receipt,
  music: Music,
  photo: Camera,
  tv: Tv,
  clothing: Shirt,
  garden: Flower,
  smoking: Cigarette,
  alcohol: Wine,
  fuel: Fuel,
  bus: Bus,
  bike: Bike,
  tools: Hammer,
  salon: Scissors,
};

// Ordered list for the icon picker UI — defaults first, then extras.
export const CATEGORY_ICON_KEYS: string[] = [
  'food', 'transport', 'housing', 'shopping', 'health', 'entertainment',
  'education', 'savings', 'debt', 'income', 'other',
  'coffee', 'beauty', 'subscription', 'travel', 'gift', 'fitness', 'pets',
  'kids', 'phone', 'internet', 'utility', 'bill', 'music', 'photo', 'tv',
  'clothing', 'garden', 'smoking', 'alcohol', 'fuel', 'bus', 'bike', 'tools', 'salon',
];

// Canonical default icons (kept for back-compat with anything still importing
// the original alias).
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

// Render any icon by its key (works for both default + extra). Falls back to
// the Package icon if the key isn't in the registry.
export function CategoryIconByKey({
  iconKey, size = 20, color = 'currentColor', strokeWidth = 1.5,
}: { iconKey: string | undefined; size?: number; color?: string; strokeWidth?: number }) {
  const Cmp = (iconKey && CATEGORY_ICON_REGISTRY[iconKey]) || Package;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
