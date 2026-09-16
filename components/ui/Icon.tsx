import {
  Briefcase,
  Building2,
  Sparkles,
  FileText,
  Wallet,
  Sun,
  Gift,
  Clock,
  TrendingUp,
  Car,
  Scale,
  CreditCard,
  PiggyBank,
  Receipt,
  ClipboardList,
  Tag,
  Percent,
  Users,
  UsersRound,
  Calendar,
  QrCode,
  FileCode,
  Coins,
  Search,
  Menu,
  X,
  ChevronRight,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa central de ícones da plataforma. Categorias e ferramentas guardam
 * apenas a chave (string) em data/categories.ts e data/tools.ts — este é o
 * único lugar que sabe traduzir a chave para o componente de ícone real.
 */
const iconMap: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  building: Building2,
  sparkles: Sparkles,
  "file-text": FileText,
  wallet: Wallet,
  sun: Sun,
  gift: Gift,
  clock: Clock,
  "trending-up": TrendingUp,
  car: Car,
  scale: Scale,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  receipt: Receipt,
  "clipboard-list": ClipboardList,
  tag: Tag,
  percent: Percent,
  users: Users,
  "users-round": UsersRound,
  calendar: Calendar,
  "qr-code": QrCode,
  "file-code": FileCode,
  coins: Coins,
  search: Search,
  menu: Menu,
  close: X,
  "chevron-right": ChevronRight,
};

export interface IconProps {
  name: string;
  className?: string;
  "aria-hidden"?: boolean;
}

export function Icon({ name, className, ...rest }: IconProps) {
  const LucideComponent = iconMap[name] ?? Wrench;
  return <LucideComponent className={className} aria-hidden {...rest} />;
}
