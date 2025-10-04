import { useState } from "react";
import { Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

interface ProtocolGeneratorProps {
  transcript: string;
  onBack: () => void;
}

export const ProtocolGenerator = ({ transcript, onBack }: ProtocolGeneratorProps) => {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [participants, setParticipants] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const generateProtocol = async () => {
    if (!meetingTitle.trim()) {
      toast({
        title: "Saknar titel",
        description: "Ange en mötestitel för att skapa protokollet.",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              // Title
              new Paragraph({
                text: "MÖTESPROTOKOLL",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              
              // Meeting title
              new Paragraph({
                children: [
                  new TextRun({
                    text: meetingTitle,
                    bold: true,
                    size: 32,
                  }),
                ],
                spacing: { after: 300 },
              }),

              // Date
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Datum: ",
                    bold: true,
                  }),
                  new TextRun(date),
                ],
                spacing: { after: 200 },
              }),

              // Location
              ...(location ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Plats: ",
                      bold: true,
                    }),
                    new TextRun(location),
                  ],
                  spacing: { after: 200 },
                })
              ] : []),

              // Participants
              ...(participants ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Deltagare: ",
                      bold: true,
                    }),
                    new TextRun(participants),
                  ],
                  spacing: { after: 300 },
                })
              ] : []),

              // Divider
              new Paragraph({
                text: "─────────────────────────────────────────",
                spacing: { after: 300 },
              }),

              // Transcript heading
              new Paragraph({
                text: "Transkription",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 200 },
              }),

              // Transcript content
              new Paragraph({
                text: transcript,
                spacing: { after: 400 },
              }),

              // Notes section (if provided)
              ...(notes ? [
                new Paragraph({
                  text: "Anteckningar",
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 200, after: 200 },
                }),
                new Paragraph({
                  text: notes,
                  spacing: { after: 200 },
                })
              ] : []),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const fileName = `Mötesprotokoll_${meetingTitle.replace(/\s+/g, '_')}_${date}.docx`;
      saveAs(blob, fileName);

      toast({
        title: "Protokoll genererat!",
        description: `${fileName} har laddats ner.`,
      });
    } catch (error) {
      console.error("Fel vid generering av protokoll:", error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa protokollet.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">Skapa mötesprotokoll</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Fyll i information och ladda ner som Word-dokument
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Mötestitel *</Label>
            <Input
              id="title"
              placeholder="T.ex. Veckomöte 2024-01-15"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Datum</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="participants">Deltagare</Label>
            <Input
              id="participants"
              placeholder="T.ex. Anna Andersson, Erik Eriksson"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Plats</Label>
            <Input
              id="location"
              placeholder="T.ex. Konferensrum A"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Ytterligare anteckningar</Label>
            <Textarea
              id="notes"
              placeholder="T.ex. beslut, åtgärdspunkter..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
            />
          </div>

          <div className="pt-4 flex gap-4">
            <Button
              onClick={generateProtocol}
              size="lg"
              className="flex-1"
            >
              <Download className="mr-2" />
              Ladda ner protokoll
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Transkriptionslängd: {transcript.split(' ').length} ord</p>
          </div>
        </div>
      </div>
    </div>
  );
};
