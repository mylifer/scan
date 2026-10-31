import { cn } from "@/lib/utils";
import { categoryLabel } from "@shared/lib/categories";

export interface CategoryVisual {
  dotColor: string;
  initial: string;
  icon: string;
  squircle: string;
}

/**
 * Minimalist Monogram & Status Dot (Option 02 - Linear / Swiss Style)
 * Emojisiz, sakin, iki harfli mikro monogram kodu ve canlı renkli durum noktası.
 */
export function getCategoryVisuals(cat: string): CategoryVisual {
  const norm = (cat || "").toLowerCase();

  if (norm.includes("akaryakıt") || norm.includes("yakıt")) {
    return {
      initial: "AK",
      dotColor: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
      icon: "⛽️",
      squircle: "bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-amber-500/20",
    };
  }
  if (norm.includes("restoran") || norm.includes("yemek") || norm.includes("kafe")) {
    return {
      initial: "RE",
      dotColor: "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]",
      icon: "🍽️",
      squircle: "bg-gradient-to-tr from-rose-500 to-pink-400 text-white shadow-rose-500/20",
    };
  }
  if (norm.includes("market") || norm.includes("gıda")) {
    return {
      initial: "MA",
      dotColor: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]",
      icon: "🛒",
      squircle: "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/20",
    };
  }
  if (norm.includes("teknoloji") || norm.includes("elektronik") || norm.includes("yazılım")) {
    return {
      initial: "TE",
      dotColor: "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]",
      icon: "💻",
      squircle: "bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-indigo-500/20",
    };
  }
  if (norm.includes("ofis") || norm.includes("kırtasiye")) {
    return {
      initial: "OF",
      dotColor: "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]",
      icon: "📎",
      squircle: "bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-sky-500/20",
    };
  }
  if (norm.includes("ulaşım") || norm.includes("taksi") || norm.includes("otopark")) {
    return {
      initial: "UL",
      dotColor: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.5)]",
      icon: "🚗",
      squircle: "bg-gradient-to-tr from-blue-500 to-indigo-400 text-white shadow-blue-500/20",
    };
  }
  if (norm.includes("araç bakım") || norm.includes("servis") || norm.includes("tamir")) {
    return {
      initial: "BA",
      dotColor: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.5)]",
      icon: "🔧",
      squircle: "bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-orange-500/20",
    };
  }
  if (norm.includes("konaklama") || norm.includes("otel")) {
    return {
      initial: "KO",
      dotColor: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]",
      icon: "🏨",
      squircle: "bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-purple-500/20",
    };
  }
  if (norm.includes("iletişim") || norm.includes("telefon") || norm.includes("internet")) {
    return {
      initial: "İL",
      dotColor: "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]",
      icon: "📱",
      squircle: "bg-gradient-to-tr from-cyan-500 to-blue-400 text-white shadow-cyan-500/20",
    };
  }
  if (norm.includes("fatura") || norm.includes("elektrik") || norm.includes("su") || norm.includes("doğalgaz")) {
    return {
      initial: "FA",
      dotColor: "bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]",
      icon: "🧾",
      squircle: "bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-teal-500/20",
    };
  }
  if (norm.includes("kargo") || norm.includes("kurye") || norm.includes("nakliye")) {
    return {
      initial: "KA",
      dotColor: "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]",
      icon: "📦",
      squircle: "bg-gradient-to-tr from-yellow-500 to-amber-400 text-white shadow-yellow-500/20",
    };
  }
  if (norm.includes("giyim") || norm.includes("tekstil") || norm.includes("ayakkabı")) {
    return {
      initial: "Gİ",
      dotColor: "bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.5)]",
      icon: "👕",
      squircle: "bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-pink-500/20",
    };
  }
  if (norm.includes("sağlık") || norm.includes("eczane") || norm.includes("hastane") || norm.includes("ilaç")) {
    return {
      initial: "SA",
      dotColor: "bg-red-400 shadow-[0_0_6px_rgba(248,113,182,0.5)]",
      icon: "💊",
      squircle: "bg-gradient-to-tr from-red-500 to-rose-400 text-white shadow-red-500/20",
    };
  }
  if (norm.includes("eğitim") || norm.includes("kurs") || norm.includes("kitap")) {
    return {
      initial: "EĞ",
      dotColor: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
      icon: "📚",
      squircle: "bg-gradient-to-tr from-amber-600 to-orange-400 text-white shadow-amber-600/20",
    };
  }
  if (norm.includes("kira")) {
    return {
      initial: "Kİ",
      dotColor: "bg-lime-400 shadow-[0_0_6px_rgba(163,230,53,0.5)]",
      icon: "🔑",
      squircle: "bg-gradient-to-tr from-lime-600 to-emerald-400 text-white shadow-lime-600/20",
    };
  }
  if (norm.includes("sigorta") || norm.includes("kasko")) {
    return {
      initial: "Sİ",
      dotColor: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]",
      icon: "🛡️",
      squircle: "bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-600/20",
    };
  }
  if (norm.includes("abonelik")) {
    return {
      initial: "AB",
      dotColor: "bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.5)]",
      icon: "🔄",
      squircle: "bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-violet-600/20",
    };
  }
  if (norm.includes("reklam") || norm.includes("pazarlama")) {
    return {
      initial: "RE",
      dotColor: "bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.5)]",
      icon: "📢",
      squircle: "bg-gradient-to-tr from-fuchsia-600 to-pink-500 text-white shadow-fuchsia-600/20",
    };
  }
  if (norm.includes("vergi") || norm.includes("harç")) {
    return {
      initial: "VE",
      dotColor: "bg-slate-400 shadow-[0_0_6px_rgba(148,163,184,0.5)]",
      icon: "🏛️",
      squircle: "bg-gradient-to-tr from-slate-700 to-zinc-600 text-white shadow-slate-700/20",
    };
  }
  if (norm.includes("banka") || norm.includes("finans") || norm.includes("komisyon")) {
    return {
      initial: "BA",
      dotColor: "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]",
      icon: "🏦",
      squircle: "bg-gradient-to-tr from-sky-700 to-blue-600 text-white shadow-sky-700/20",
    };
  }
  if (norm.includes("yapı") || norm.includes("nalbur") || norm.includes("hırdavat")) {
    return {
      initial: "YA",
      dotColor: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.5)]",
      icon: "🔨",
      squircle: "bg-gradient-to-tr from-orange-700 to-amber-600 text-white shadow-orange-700/20",
    };
  }
  if (norm.includes("kişisel bakım") || norm.includes("kuaför") || norm.includes("berber")) {
    return {
      initial: "KB",
      dotColor: "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]",
      icon: "✨",
      squircle: "bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-rose-600/20",
    };
  }
  if (norm.includes("hediye")) {
    return {
      initial: "HE",
      dotColor: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)]",
      icon: "🎁",
      squircle: "bg-gradient-to-tr from-red-500 to-pink-400 text-white shadow-red-500/20",
    };
  }
  if (norm.includes("eğlence") || norm.includes("sinema") || norm.includes("tiyatro") || norm.includes("etkinlik")) {
    return {
      initial: "EĞ",
      dotColor: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]",
      icon: "🍿",
      squircle: "bg-gradient-to-tr from-purple-600 to-violet-500 text-white shadow-purple-600/20",
    };
  }

  return {
    initial: (cat.slice(0, 2) || "Dİ").toLocaleUpperCase("tr-TR"),
    dotColor: "bg-zinc-400 shadow-[0_0_6px_rgba(161,161,170,0.5)]",
    icon: "📄",
    squircle: "bg-gradient-to-tr from-slate-600 to-zinc-500 text-white shadow-slate-500/20",
  };
}

/**
 * Minimalist Monogram & Status Dot Rozeti Bileşeni
 * Linear & Swiss stili: yuvarlak renkli durum noktası + 2 harfli kod + kategori adı
 */
export function CategoryBadge({
  category,
  size = "md",
  className,
}: {
  category: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const visual = getCategoryVisuals(category);
  const label = categoryLabel(category);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg font-medium select-none shrink-0 transition-colors",
        "bg-muted/70 hover:bg-muted border border-border/80 text-foreground",
        "dark:bg-zinc-900/90 dark:hover:bg-zinc-800 dark:border-white/[0.08] dark:text-zinc-200",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <span className={cn("rounded-full shrink-0", size === "sm" ? "size-1.5" : "size-2", visual.dotColor)} />
      <span
        className={cn(
          "font-bold uppercase tracking-wider text-muted-foreground dark:text-zinc-400",
          size === "sm" ? "text-[9px]" : "text-[10px]",
        )}
      >
        {visual.initial}
      </span>
      <span className="font-semibold text-foreground dark:text-zinc-200 truncate">
        {label}
      </span>
    </span>
  );
}
