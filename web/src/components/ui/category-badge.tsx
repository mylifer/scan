import { cn } from "@/lib/utils";
import { categoryLabel } from "@shared/lib/categories";

export interface CategoryVisual {
  icon: string;
  initial: string;
  iconBg: string;
  textBg: string;
  border: string;
  squircle: string;
}

/**
 * Dual-Tone Segmentli Rozet (Option 04 - Stripe / Geliştirici Stili)
 * Sol taraf doymuş renkli ikon bloğu, sağ taraf yarı saydam pastel metin alanı.
 */
export function getCategoryVisuals(cat: string): CategoryVisual {
  const norm = (cat || "").toLowerCase();

  if (norm.includes("akaryakıt") || norm.includes("yakıt")) {
    return {
      icon: "⛽️",
      initial: "AK",
      iconBg: "bg-amber-500 text-zinc-950 font-bold",
      textBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      border: "border-amber-500/30",
      squircle: "bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-amber-500/20",
    };
  }
  if (norm.includes("restoran") || norm.includes("yemek") || norm.includes("kafe")) {
    return {
      icon: "🍽️",
      initial: "RE",
      iconBg: "bg-rose-500 text-white font-bold",
      textBg: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
      border: "border-rose-500/30",
      squircle: "bg-gradient-to-tr from-rose-500 to-pink-400 text-white shadow-rose-500/20",
    };
  }
  if (norm.includes("market") || norm.includes("gıda")) {
    return {
      icon: "🛒",
      initial: "MA",
      iconBg: "bg-emerald-500 text-zinc-950 font-bold",
      textBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
      squircle: "bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-500/20",
    };
  }
  if (norm.includes("teknoloji") || norm.includes("elektronik") || norm.includes("yazılım")) {
    return {
      icon: "💻",
      initial: "TE",
      iconBg: "bg-indigo-600 text-white font-bold",
      textBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-500/30",
      squircle: "bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-indigo-500/20",
    };
  }
  if (norm.includes("ofis") || norm.includes("kırtasiye")) {
    return {
      icon: "📎",
      initial: "OF",
      iconBg: "bg-sky-500 text-zinc-950 font-bold",
      textBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      border: "border-sky-500/30",
      squircle: "bg-gradient-to-tr from-sky-500 to-cyan-400 text-white shadow-sky-500/20",
    };
  }
  if (norm.includes("ulaşım") || norm.includes("taksi") || norm.includes("otopark")) {
    return {
      icon: "🚗",
      initial: "UL",
      iconBg: "bg-blue-600 text-white font-bold",
      textBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
      border: "border-blue-500/30",
      squircle: "bg-gradient-to-tr from-blue-500 to-indigo-400 text-white shadow-blue-500/20",
    };
  }
  if (norm.includes("araç bakım") || norm.includes("servis") || norm.includes("tamir")) {
    return {
      icon: "🔧",
      initial: "BA",
      iconBg: "bg-orange-600 text-white font-bold",
      textBg: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
      border: "border-orange-500/30",
      squircle: "bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-orange-500/20",
    };
  }
  if (norm.includes("konaklama") || norm.includes("otel")) {
    return {
      icon: "🏨",
      initial: "KO",
      iconBg: "bg-purple-600 text-white font-bold",
      textBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
      border: "border-purple-500/30",
      squircle: "bg-gradient-to-tr from-purple-500 to-pink-500 text-white shadow-purple-500/20",
    };
  }
  if (norm.includes("iletişim") || norm.includes("telefon") || norm.includes("internet")) {
    return {
      icon: "📱",
      initial: "İL",
      iconBg: "bg-cyan-600 text-white font-bold",
      textBg: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
      border: "border-cyan-500/30",
      squircle: "bg-gradient-to-tr from-cyan-500 to-blue-400 text-white shadow-cyan-500/20",
    };
  }
  if (norm.includes("fatura") || norm.includes("elektrik") || norm.includes("su") || norm.includes("doğalgaz")) {
    return {
      icon: "🧾",
      initial: "FA",
      iconBg: "bg-teal-600 text-white font-bold",
      textBg: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
      border: "border-teal-500/30",
      squircle: "bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-teal-500/20",
    };
  }
  if (norm.includes("kargo") || norm.includes("kurye") || norm.includes("nakliye")) {
    return {
      icon: "📦",
      initial: "KA",
      iconBg: "bg-amber-600 text-white font-bold",
      textBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      border: "border-amber-500/30",
      squircle: "bg-gradient-to-tr from-amber-600 to-yellow-500 text-white shadow-amber-600/20",
    };
  }
  if (norm.includes("giyim") || norm.includes("tekstil") || norm.includes("ayakkabı")) {
    return {
      icon: "👕",
      initial: "Gİ",
      iconBg: "bg-pink-600 text-white font-bold",
      textBg: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
      border: "border-pink-500/30",
      squircle: "bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-pink-500/20",
    };
  }
  if (norm.includes("sağlık") || norm.includes("eczane") || norm.includes("hastane") || norm.includes("ilaç")) {
    return {
      icon: "💊",
      initial: "SA",
      iconBg: "bg-red-600 text-white font-bold",
      textBg: "bg-red-500/10 text-red-700 dark:text-red-300",
      border: "border-red-500/30",
      squircle: "bg-gradient-to-tr from-red-500 to-rose-400 text-white shadow-red-500/20",
    };
  }
  if (norm.includes("eğitim") || norm.includes("kurs") || norm.includes("kitap")) {
    return {
      icon: "📚",
      initial: "EĞ",
      iconBg: "bg-amber-600 text-white font-bold",
      textBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      border: "border-amber-500/30",
      squircle: "bg-gradient-to-tr from-amber-600 to-orange-400 text-white shadow-amber-600/20",
    };
  }
  if (norm.includes("kira")) {
    return {
      icon: "🔑",
      initial: "Kİ",
      iconBg: "bg-lime-600 text-white font-bold",
      textBg: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
      border: "border-lime-500/30",
      squircle: "bg-gradient-to-tr from-lime-600 to-emerald-400 text-white shadow-lime-600/20",
    };
  }
  if (norm.includes("sigorta") || norm.includes("kasko")) {
    return {
      icon: "🛡️",
      initial: "Sİ",
      iconBg: "bg-emerald-600 text-white font-bold",
      textBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-500/30",
      squircle: "bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-600/20",
    };
  }
  if (norm.includes("abonelik")) {
    return {
      icon: "🔄",
      initial: "AB",
      iconBg: "bg-violet-600 text-white font-bold",
      textBg: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      border: "border-violet-500/30",
      squircle: "bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-violet-600/20",
    };
  }
  if (norm.includes("reklam") || norm.includes("pazarlama")) {
    return {
      icon: "📢",
      initial: "RE",
      iconBg: "bg-fuchsia-600 text-white font-bold",
      textBg: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
      border: "border-fuchsia-500/30",
      squircle: "bg-gradient-to-tr from-fuchsia-600 to-pink-500 text-white shadow-fuchsia-600/20",
    };
  }
  if (norm.includes("vergi") || norm.includes("harç")) {
    return {
      icon: "🏛️",
      initial: "VE",
      iconBg: "bg-slate-700 text-white font-bold",
      textBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      border: "border-slate-500/30",
      squircle: "bg-gradient-to-tr from-slate-700 to-zinc-600 text-white shadow-slate-700/20",
    };
  }
  if (norm.includes("banka") || norm.includes("finans") || norm.includes("komisyon")) {
    return {
      icon: "🏦",
      initial: "BA",
      iconBg: "bg-sky-700 text-white font-bold",
      textBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      border: "border-sky-500/30",
      squircle: "bg-gradient-to-tr from-sky-700 to-blue-600 text-white shadow-sky-700/20",
    };
  }
  if (norm.includes("yapı") || norm.includes("nalbur") || norm.includes("hırdavat")) {
    return {
      icon: "🔨",
      initial: "YA",
      iconBg: "bg-orange-700 text-white font-bold",
      textBg: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
      border: "border-orange-500/30",
      squircle: "bg-gradient-to-tr from-orange-700 to-amber-600 text-white shadow-orange-700/20",
    };
  }
  if (norm.includes("kişisel bakım") || norm.includes("kuaför") || norm.includes("berber")) {
    return {
      icon: "✨",
      initial: "KB",
      iconBg: "bg-rose-600 text-white font-bold",
      textBg: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
      border: "border-rose-500/30",
      squircle: "bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-rose-600/20",
    };
  }
  if (norm.includes("hediye")) {
    return {
      icon: "🎁",
      initial: "HE",
      iconBg: "bg-red-500 text-white font-bold",
      textBg: "bg-red-500/10 text-red-700 dark:text-red-300",
      border: "border-red-500/30",
      squircle: "bg-gradient-to-tr from-red-500 to-pink-400 text-white shadow-red-500/20",
    };
  }
  if (norm.includes("eğlence") || norm.includes("sinema") || norm.includes("tiyatro") || norm.includes("etkinlik")) {
    return {
      icon: "🍿",
      initial: "EĞ",
      iconBg: "bg-purple-600 text-white font-bold",
      textBg: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
      border: "border-purple-500/30",
      squircle: "bg-gradient-to-tr from-purple-600 to-violet-500 text-white shadow-purple-600/20",
    };
  }

  return {
    icon: "📄",
    initial: (cat.slice(0, 2) || "Fİ").toLocaleUpperCase("tr-TR"),
    iconBg: "bg-zinc-600 text-white font-bold",
    textBg: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-500/30",
    squircle: "bg-gradient-to-tr from-slate-600 to-zinc-500 text-white shadow-slate-500/20",
  };
}

/**
 * Dual-Tone Segmentli Kategori Rozeti Bileşeni
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
    <div
      className={cn(
        "inline-flex items-stretch rounded-lg overflow-hidden border font-semibold shadow-2xs select-none shrink-0 transition-colors",
        size === "sm" ? "text-[10px]" : "text-xs",
        visual.border,
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center shrink-0",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
          visual.iconBg,
        )}
      >
        {visual.icon}
      </span>
      <span
        className={cn(
          "flex items-center truncate",
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]",
          visual.textBg,
        )}
      >
        {label}
      </span>
    </div>
  );
}
