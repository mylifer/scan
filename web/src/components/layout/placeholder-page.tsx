import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "./page-header";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Construction className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Bu sayfa yakında yeni web arayüzüne taşınacak</p>
        </CardContent>
      </Card>
    </div>
  );
}
