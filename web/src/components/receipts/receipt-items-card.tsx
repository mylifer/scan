"use client";

import { kalemlerTutarli, kalemToplami } from "@shared/lib/kalemler";
import { formatTL } from "@shared/lib/format";
import type { FisKalemi, ReceiptRecord } from "@shared/types/receipt";
import { ListChecks } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, Chip, Table } from "@heroui/react";
import { fisKalemleri } from "@/lib/kalemler";

const miktarMetni = (k: FisKalemi) =>
  `${k.miktar.toLocaleString("tr-TR", { maximumFractionDigits: 3 })}${k.birim ? ` ${k.birim}` : ""}`;

/** Fişin okunan ürün/hizmet satırları; kalem yoksa hiçbir şey çizmez */
export function ReceiptItemsCard({ record }: { record: ReceiptRecord }) {
  const [kalemler, setKalemler] = useState<FisKalemi[]>([]);

  useEffect(() => {
    let iptal = false;
    void fisKalemleri(record.id).then((k) => {
      if (!iptal) setKalemler(k);
    });
    return () => {
      iptal = true;
    };
  }, [record.id]);

  if (!kalemler.length) return null;
  const toplam = kalemToplami(kalemler);
  const tutarli = kalemlerTutarli(kalemler, record.toplam_tutar);

  return (
    <Card>
      <Card.Header className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ListChecks className="size-5 text-accent" />
            <Card.Title>Kalemler</Card.Title>
          </div>
          <Card.Description>Fişteki ürün ve hizmet satırları (yapay zekâ ile okundu).</Card.Description>
        </div>
        {tutarli ? (
          <Chip size="sm" variant="soft" color="success">Toplamla tutarlı</Chip>
        ) : (
          <Chip size="sm" variant="soft" color="warning">Kalem toplamı {formatTL(toplam)}</Chip>
        )}
      </Card.Header>
      <Card.Content>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Fiş kalemleri" className="min-w-[520px]">
              <Table.Header>
                <Table.Column isRowHeader>Ürün / Hizmet</Table.Column>
                <Table.Column className="text-right">Miktar</Table.Column>
                <Table.Column className="text-right">Birim fiyat</Table.Column>
                <Table.Column className="text-right">KDV</Table.Column>
                <Table.Column className="text-right">Tutar</Table.Column>
              </Table.Header>
              <Table.Body>
                {kalemler.map((k, i) => (
                  <Table.Row key={i} id={i}>
                    <Table.Cell>{k.ad}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums whitespace-nowrap">{miktarMetni(k)}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{k.birimFiyat ? formatTL(k.birimFiyat) : "—"}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{k.kdvOrani ? `%${k.kdvOrani}` : "—"}</Table.Cell>
                    <Table.Cell className="text-right tabular-nums">{formatTL(k.tutar)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
}
