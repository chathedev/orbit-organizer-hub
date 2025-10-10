import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Transcript() {
  const location = useLocation();
  const navigate = useNavigate();
  const { meeting } = location.state || {};

  if (!meeting) {
    navigate('/library');
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/library')}>
              <ArrowLeft />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-card-foreground">{meeting.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDate(meeting.updated_at)} • {formatDuration(meeting.duration_seconds)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Transkription</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {meeting.transcript || meeting.interim_transcript || "Ingen transkription tillgänglig"}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
