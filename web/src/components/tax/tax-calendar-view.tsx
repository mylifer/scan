"use client";

import {
  daysUntil,
  formatTrDate,
  taxDeadlines,
  todayIso,
  type TaxDeadline,
  type TaxKind,
} from "@shared/lib/taxCalendar";
import { Clock, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { countPastDeadlines, filterTaxDeadlines, taxYearOptions } from "@/lib/taxCalendar";
import { Card, Chip, ListBox, Select, Switch, Table } from "@heroui/react";

const TAX_KIND_LABELS: Record<TaxKind, string> = {
  kdv: "KDV",
  muhtasar: "Muhtasar",
  babs: "Ba-Bs Formu",
  gecici: "Geçici Vergi",
  yillik: "Yıllık Gelir Vergisi",
  "yillik-taksit": "Gelir Vergisi 2. Taksit",
};

const KIND_OPTIONS = [
  { id: "all", label: "Tüm yükümlülükler" },
  { id: "kdv", label: "KDV beyannamesi" },
  { id: "gecici", label: "Geçici vergi" },
  { id: "yillik", label: "Yıllık gelir vergisi" },
  { id: "muhtasar", label: "Muhtasar (stopaj)" },
  { id: "babs", label: "Ba-Bs formu" },
];

/** "2 Kasım 2026 Pazartesi" → ["2 Kasım 2026", "Pazartesi"] */
function splitTrDate(iso: string): [string, string] {
  const full = formatTrDate(iso);
  const i = full.lastIndexOf(" ");
  return [full.slice(0, i), full.slice(i + 1)];
}

export function TaxCalendarView() {
  const today = useMemo(() => todayIso(), []);
  const yearOptions = useMemo(() => taxYearOptions(today), [today]);
  const [selectedYear, setSelectedYear] = useState<string>(() => today.slice(0, 4));
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [showPast, setShowPast] = useState<boolean>(false);

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

  const remaining = (days: number) => (days === 0 ? "Bugün son gün" : `${days} gün kaldı`);
  const nextDays = nextDeadline ? daysUntil(nextDeadline.date, today) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vergi Takvimi"
        description="Şahıs işletmeleri için yasal beyanname ve ödeme son günleri (VUK 18 tatil kaydırmaları dahil)."
      />

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3">
        <Select className="w-36" aria-label="Yıl" value={selectedYear} onChange={(key) => setSelectedYear(String(key))}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {yearOptions.map((y) => (
                <ListBox.Item key={y} id={y}>
                  {y}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select className="w-56" aria-label="Yükümlülük türü" value={kindFilter} onChange={(key) => setKindFilter(String(key))}>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {KIND_OPTIONS.map((o) => (
                <ListBox.Item key={o.id} id={o.id}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Switch isSelected={showPast} onChange={setShowPast} className="ms-1">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <span className="whitespace-nowrap text-sm">Geçmişi göster{pastCount > 0 ? ` (${pastCount})` : ""}</span>
          </Switch.Content>
        </Switch>
      </div>

      {/* Sıradaki yükümlülük */}
      {nextDeadline && (
        <Card>
          <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <Clock className="size-3.5" />
                Sıradaki yükümlülük
              </span>
              <h2 className="text-lg font-semibold">{nextDeadline.title}</h2>
              <Card.Description>
                {nextDeadline.period} · Son gün{" "}
                <span className="font-medium text-foreground">{formatTrDate(nextDeadline.date)}</span>
              </Card.Description>
            </div>
            <Chip size="lg" color={nextDays <= 5 ? "danger" : "accent"} variant="soft" className="shrink-0 tabular-nums">
              {remaining(nextDays)}
            </Chip>
          </Card.Header>
          {nextDeadline.notes.length > 0 && (
            <Card.Content>
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {nextDeadline.notes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </Card.Content>
          )}
        </Card>
      )}

      {/* Yasal süreler tablosu */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Vergi takvimi" className="min-w-[1000px]">
            <Table.Header>
              <Table.Column className="w-40">Son gün</Table.Column>
              <Table.Column isRowHeader className="w-80">Yükümlülük</Table.Column>
              <Table.Column className="w-52">Dönem</Table.Column>
              <Table.Column className="w-36">Kalan süre</Table.Column>
              <Table.Column>Not</Table.Column>
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                  <Clock className="size-6 text-muted" />
                  <p className="text-sm font-medium">Görüntülenecek yükümlülük yok.</p>
                  <p className="text-sm text-muted">
                    {pastCount > 0 && !showPast
                      ? `Bu yılda ${pastCount} tamamlanmış yükümlülük var; görmek için "Geçmişi göster"i açın.`
                      : "Farklı bir yıl veya tür seçebilirsiniz."}
                  </p>
                </div>
              )}
            >
              {filteredDeadlines.map((item, idx) => {
                const days = daysUntil(item.date, today);
                const [datePart, weekday] = splitTrDate(item.date);
                return (
                  <Table.Row key={idx} id={idx}>
                    <Table.Cell>
                      <div className="whitespace-nowrap text-sm font-medium tabular-nums">{datePart}</div>
                      <div className="text-xs text-muted">{weekday}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-muted">{TAX_KIND_LABELS[item.kind]}</div>
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-sm text-muted">{item.period}</Table.Cell>
                    <Table.Cell>
                      {days < 0 ? (
                        <Chip size="sm" color="success" variant="soft">Tamamlandı</Chip>
                      ) : (
                        <Chip
                          size="sm"
                          color={days <= 5 ? "danger" : days <= 15 ? "warning" : "default"}
                          variant={days <= 15 ? "soft" : "secondary"}
                          className="whitespace-nowrap tabular-nums"
                        >
                          {remaining(days)}
                        </Chip>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-xs text-muted">
                      {item.notes.length > 0 ? item.notes.join(" ") : "—"}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {/* Yasal bilgilendirme */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-1.5">
            <Info className="size-4 text-muted" />
            Yasal dayanak ve süre uzatımları
          </Card.Title>
          <Card.Description>
            VUK 18. madde uyarınca resmî tatile veya hafta sonuna denk gelen son günler izleyen ilk iş gününe kaydırılmıştır.
            GİB&apos;in sonradan ilan edebileceği süre uzatımları resmî duyurulardan teyit edilmelidir.
          </Card.Description>
        </Card.Header>
      </Card>
    </div>
  );
}
