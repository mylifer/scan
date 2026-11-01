import { Construction } from "lucide-react";
import { PageHeader } from "./page-header";
import { Card } from "@heroui/react";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <Card>
        <Card.Content className="flex flex-col items-center gap-2 text-center">
          <Construction className="size-8 text-muted" />
          <p className="text-sm text-muted">Bu sayfa yakında yeni web arayüzüne taşınacak</p>
        </Card.Content>
      </Card>
    </div>
  );
}
