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
import { countPastDeadlines, filterTaxDeadlines } from "@/lib/taxCalendar";
import { Card, Checkbox, Chip, Label, ListBox, Select, Table } from "@heroui/react";

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
          <Select className="w-32" placeholder="Yıl" aria-label="Yıl" value={selectedYear} onChange={(key) => setSelectedYear(String(key))}>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="2026">
                  2026 Yılı
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="2027">
                  2027 Yılı
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
          </Select.Popover>
          </Select>

          <Select className="w-44" placeholder="Tür Filtresi" aria-label="Tür Filtresi" value={kindFilter} onChange={(key) => setKindFilter(String(key))}>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all">
                  Tüm Yükümlülükler
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="kdv">
                  KDV Beyannamesi
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="gecici">
                  Geçici Vergi
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="yillik">
                  Yıllık Gelir Vergisi
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="muhtasar">
                  Muhtasar (Stopaj)
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="babs">
                  Ba-Bs Formu
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
          </Select.Popover>
          </Select>

          <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm shadow-2xs">
            <Checkbox variant="secondary" isSelected={showPast} onChange={setShowPast}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="cursor-pointer text-xs font-medium text-foreground">Geçmiş satırları göster</Label>
              </Checkbox.Content>
            </Checkbox>
            {pastCount > 0 && (
              <Chip size="sm" variant="soft">
                {pastCount}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* Yaklaşan İlk Beyanname Kartı */}
      {nextDeadline && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-accent">
              <Clock className="size-4" />
              Sıradaki En Yakın Yükümlülük
            </div>
            <Card.Title className="text-xl">
              {nextDeadline.title} ({nextDeadline.period})
            </Card.Title>
            <Card.Description>
              Son Gün: <span className="font-semibold text-foreground">{formatTrDate(nextDeadline.date)}</span>
              {nextDeadline.legalDate !== nextDeadline.date && (
                <span className="ml-1 text-muted">
                  (Yasal son gün {formatTrDate(nextDeadline.legalDate)}, tatil nedeniyle kaydırıldı)
                </span>
              )}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="soft" className="tabular-nums">
                {daysUntil(nextDeadline.date, today) === 0
                  ? "Bugün son gün!"
                  : `${daysUntil(nextDeadline.date, today)} gün kaldı`}
              </Chip>
              {nextDeadline.notes.map((note, idx) => (
                <span key={idx} className="text-xs text-muted">
                  • {note}
                </span>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Yasal Süreler Tablosu */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Vergi takvimi" className="min-w-[620px]">
            <Table.Header>
              <Table.Column isRowHeader className="w-40">Son Gün</Table.Column>
              <Table.Column>Yükümlülük</Table.Column>
              <Table.Column className="w-44">Dönem</Table.Column>
              <Table.Column className="w-32">Kalan Süre</Table.Column>
              <Table.Column>Açıklama / Notlar</Table.Column>
            </Table.Header>
            <Table.Body>
              {filteredDeadlines.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                      <Clock className="size-6 text-muted/50" />
                      <p className="font-medium text-foreground">Görüntülenecek yaklaşan vergi yükümlülüğü bulunamadı.</p>
                      {pastCount > 0 && !showPast ? (
                        <p className="text-xs text-muted">
                          Seçilen dönemde {pastCount} adet tamamlanmış yükümlülük var. Görmek için yukarıdaki &quot;Geçmiş satırları göster&quot; kutusunu işaretleyebilirsiniz.
                        </p>
                      ) : (
                        <p className="text-xs text-muted">
                          Farklı bir yıl veya tür filtresi seçebilirsiniz.
                        </p>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ) : (
                filteredDeadlines.map((item, idx) => {
                  const days = daysUntil(item.date, today);
                  const isPast = days < 0;
                  const isToday = days === 0;
                  const isUrgent = days > 0 && days <= 5;
                  const isShifted = item.legalDate !== item.date;

                  return (
                    <Table.Row
                      key={idx} id={idx}
                      className={isPast ? "opacity-60" : isUrgent ? "bg-amber-500/5 font-medium" : undefined}
                    >
                      <Table.Cell className="font-semibold tabular-nums text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted" />
                          {formatTrDate(item.date)}
                        </div>
                        {isShifted && (
                          <div className="text-[10px] text-muted">
                            Yasal: {formatTrDate(item.legalDate)}
                          </div>
                        )}
                      </Table.Cell>

                      <Table.Cell>
                        <div className="font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted">{TAX_KIND_LABELS[item.kind]}</div>
                      </Table.Cell>

                      <Table.Cell className="text-xs text-muted">{item.period}</Table.Cell>

                      <Table.Cell>
                        {isPast ? (
                          <Chip size="sm" variant="secondary">
                            Tamamlandı
                          </Chip>
                        ) : isToday ? (
                          <Chip size="sm" color="danger" variant="soft">
                            Bugün!
                          </Chip>
                        ) : isUrgent ? (
                          <Chip size="sm" color="danger" variant="soft">
                            {days} gün kaldı
                          </Chip>
                        ) : (
                          <Chip size="sm" variant="soft">
                            {days} gün kaldı
                          </Chip>
                        )}
                      </Table.Cell>

                      <Table.Cell className="text-xs text-muted">
                        {item.notes.length > 0 ? (
                          <div className="space-y-0.5">
                            {item.notes.map((n, i) => (
                              <div key={i} className="flex items-center gap-1">
                                <Info className="size-3 shrink-0 text-muted" />
                                <span>{n}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Yasal Bilgilendirme Kartı */}
      <Card>
        <Card.Content className="space-y-2 text-xs text-muted">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-4 text-accent" />
            Yasal Dayanak ve Süre Uzatımları
          </div>
          <p>
            VUK 18. maddesi uyarınca, resmî tatile veya hafta sonuna denk gelen son günler otomatik olarak izleyen ilk iş gününe kaydırılmıştır.
            Gelir İdaresi Başkanlığı&apos;nın (GİB) sonradan ilan edebileceği münferit süre uzatımları resmi duyurulardan teyit edilmelidir.
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
