"use client";

import {
  daysUntil,
  formatTrDate,
  taxDeadlines,
  todayIso,
  type TaxDeadline,
  type TaxKind,
} from "@shared/lib/taxCalendar";
import {
  Calendar,
  Clock,
  Info,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countPastDeadlines, filterTaxDeadlines } from "@/lib/taxCalendar";

const TAX_KIND_LABELS: Record<TaxKind, string> = {
  kdv: "KDV",
  muhtasar: "Muhtasar",
  babs: "Ba-Bs Formu",
  gecici: "Geçici Vergi",
  yillik: "Yıllık Gelir Vergisi",
  "yillik-taksit": "Gelir Vergisi 2. Taksit",
};

export function TaxCalendarView() {
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [showPast, setShowPast] = useState<boolean>(false);

  const today = useMemo(() => todayIso(), []);

  // Seçilen yıla ait tüm beyanname ve ödeme son günleri
  const deadlines = useMemo<TaxDeadline[]>(() => {
    const from = `${selectedYear}-01-01`;
    const to = `${selectedYear}-12-31`;
    return taxDeadlines(from, to);
  }, [selectedYear]);

  // Geçmiş kayıt sayısı (seçilen yıl ve türe göre)
  const pastCount = useMemo(() => {
    return countPastDeadlines(deadlines, { kind: kindFilter, today });
  }, [deadlines, kindFilter, today]);

  // Filtreleme (Tür ve Geçmiş Durumu)
  const filteredDeadlines = useMemo(() => {
    return filterTaxDeadlines(deadlines, {
      kind: kindFilter,
      showPast,
      today,
    });
  }, [deadlines, kindFilter, showPast, today]);

  // Yaklaşan ilk yükümlülük
  const nextDeadline = useMemo(() => {
    return deadlines.find((d) => daysUntil(d.date, today) >= 0);
  }, [deadlines, today]);

  return (
    <div className="space-y-6">
      {/* Başlık ve Filtreler */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Vergi Takvimi"
          description="Şahıs işletmeleri için yasal beyanname ve vergi ödeme günleri (VUK 18 tatil kaydırmaları dahil)."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Yıl" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026 Yılı</SelectItem>
              <SelectItem value="2027">2027 Yılı</SelectItem>
            </SelectContent>
          </Select>

          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Tür Filtresi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Yükümlülükler</SelectItem>
              <SelectItem value="kdv">KDV Beyannamesi</SelectItem>
              <SelectItem value="gecici">Geçici Vergi</SelectItem>
              <SelectItem value="yillik">Yıllık Gelir Vergisi</SelectItem>
              <SelectItem value="muhtasar">Muhtasar (Stopaj)</SelectItem>
              <SelectItem value="babs">Ba-Bs Formu</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm shadow-2xs">
            <Checkbox
              id="show-past-tax"
              checked={showPast}
              onCheckedChange={(checked) => setShowPast(Boolean(checked))}
            />
            <Label htmlFor="show-past-tax" className="cursor-pointer text-xs font-medium text-foreground">
              Geçmiş satırları göster
            </Label>
            {pastCount > 0 && (
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px]">
                {pastCount}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Yaklaşan İlk Beyanname Kartı */}
      {nextDeadline && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <Clock className="size-4" />
              Sıradaki En Yakın Yükümlülük
            </div>
            <CardTitle className="text-xl">
              {nextDeadline.title} ({nextDeadline.period})
            </CardTitle>
            <CardDescription>
              Son Gün: <span className="font-semibold text-foreground">{formatTrDate(nextDeadline.date)}</span>
              {nextDeadline.legalDate !== nextDeadline.date && (
                <span className="ml-1 text-muted-foreground">
                  (Yasal son gün {formatTrDate(nextDeadline.legalDate)}, tatil nedeniyle kaydırıldı)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {daysUntil(nextDeadline.date, today) === 0
                  ? "Bugün son gün!"
                  : `${daysUntil(nextDeadline.date, today)} gün kaldı`}
              </Badge>
              {nextDeadline.notes.map((note, idx) => (
                <span key={idx} className="text-xs text-muted-foreground">
                  • {note}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yasal Süreler Tablosu */}
      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Son Gün</TableHead>
                <TableHead>Yükümlülük</TableHead>
                <TableHead className="w-44">Dönem</TableHead>
                <TableHead className="w-32">Kalan Süre</TableHead>
                <TableHead>Açıklama / Notlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeadlines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                      <Clock className="size-6 text-muted-foreground/50" />
                      <p className="font-medium text-foreground">Görüntülenecek yaklaşan vergi yükümlülüğü bulunamadı.</p>
                      {pastCount > 0 && !showPast ? (
                        <p className="text-xs text-muted-foreground">
                          Seçilen dönemde {pastCount} adet tamamlanmış yükümlülük var. Görmek için yukarıdaki &quot;Geçmiş satırları göster&quot; kutusunu işaretleyebilirsiniz.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Farklı bir yıl veya tür filtresi seçebilirsiniz.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeadlines.map((item, idx) => {
                  const days = daysUntil(item.date, today);
                  const isPast = days < 0;
                  const isToday = days === 0;
                  const isUrgent = days > 0 && days <= 5;
                  const isShifted = item.legalDate !== item.date;

                  return (
                    <TableRow
                      key={idx}
                      className={isPast ? "opacity-60" : isUrgent ? "bg-amber-500/5 font-medium" : undefined}
                    >
                      <TableCell className="font-semibold tabular-nums text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          {formatTrDate(item.date)}
                        </div>
                        {isShifted && (
                          <div className="text-[10px] text-muted-foreground">
                            Yasal: {formatTrDate(item.legalDate)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{TAX_KIND_LABELS[item.kind]}</div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">{item.period}</TableCell>

                      <TableCell>
                        {isPast ? (
                          <Badge variant="outline" className="text-muted-foreground text-[11px]">
                            Tamamlandı
                          </Badge>
                        ) : isToday ? (
                          <Badge variant="destructive" className="animate-pulse text-[11px]">
                            Bugün!
                          </Badge>
                        ) : isUrgent ? (
                          <Badge variant="destructive" className="text-[11px]">
                            {days} gün kaldı
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px]">
                            {days} gün kaldı
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {item.notes.length > 0 ? (
                          <div className="space-y-0.5">
                            {item.notes.map((n, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <Info className="size-3 shrink-0 text-muted-foreground" />
                                <span>{n}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Yasal Bilgilendirme Kartı */}
      <Card size="sm" className="bg-muted/30">
        <CardContent className="space-y-2 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-4 text-primary" />
            Yasal Dayanak ve Süre Uzatımları
          </div>
          <p>
            VUK 18. maddesi uyarınca, resmî tatile veya hafta sonuna denk gelen son günler otomatik olarak izleyen ilk iş gününe kaydırılmıştır.
            Gelir İdaresi Başkanlığı&apos;nın (GİB) sonradan ilan edebileceği münferit süre uzatımları resmi duyurulardan teyit edilmelidir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
