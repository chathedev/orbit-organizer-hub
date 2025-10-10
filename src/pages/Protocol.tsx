import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { EmailDialog } from "@/components/EmailDialog";
import { supabase } from "@/integrations/supabase/client";

interface AIProtocol {
  title: string;
  summary: string;
  mainPoints: string[];
  decisions: string[];
  actionItems: string[];
}

export default function Protocol() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [protocol, setProtocol] = useState<AIProtocol | null>(null);

  const { transcript, meetingName, meetingId } = location.state || {};

  useEffect(() => {
    if (!transcript) {
      navigate('/');
      return;
    }

    const generateProtocol = async () => {
      try {
        setIsGenerating(true);
        setProgress(10);

        // Generate AI protocol
        setProgress(30);
        const { data, error } = await supabase.functions.invoke('generate-meeting-protocol', {
          body: { transcript }
        });

        if (error) throw error;

        setProgress(60);

        const aiProtocol: AIProtocol = data || {
          title: meetingName || 'Mötesprotokoll',
          summary: transcript.slice(0, 200),
          mainPoints: transcript.split('.').filter(s => s.trim()).slice(0, 5),
          decisions: [],
          actionItems: [],
        };

        setProtocol(aiProtocol);
        setProgress(70);

        // Generate .docx
        const now = new Date();
        const dateStr = now.toLocaleDateString('sv-SE');
        const timeStr = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                text: "MÖTESPROTOKOLL",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              new Paragraph({
                children: [new TextRun({ text: aiProtocol.title, bold: true, size: 32 })],
                spacing: { after: 300 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Datum: ", bold: true }),
                  new TextRun(dateStr),
                  new TextRun({ text: " | Tid: ", bold: true }),
                  new TextRun(timeStr),
                ],
                spacing: { after: 300 },
              }),
              new Paragraph({ text: "─────────────────────────────────────────", spacing: { after: 300 } }),
              new Paragraph({ text: "Sammanfattning", heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
              new Paragraph({ text: aiProtocol.summary, spacing: { after: 300 } }),
              new Paragraph({ text: "Huvudpunkter", heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 } }),
              ...aiProtocol.mainPoints.map(point => new Paragraph({ text: `• ${point}`, spacing: { after: 100 } })),
              ...(aiProtocol.decisions.length > 0 ? [
                new Paragraph({ text: "Beslut", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
                ...aiProtocol.decisions.map(decision => new Paragraph({ text: `• ${decision}`, spacing: { after: 100 } })),
              ] : []),
              ...(aiProtocol.actionItems.length > 0 ? [
                new Paragraph({ text: "Åtgärdspunkter", heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }),
                ...aiProtocol.actionItems.map(item => new Paragraph({ text: `• ${item}`, spacing: { after: 100 } })),
              ] : []),
            ],
          }],
        });

        setProgress(90);
        const blob = await Packer.toBlob(doc);
        const generatedFileName = `Motesprotokoll_${dateStr}_${timeStr.replace(':', '-')}.docx`;
        
        setProgress(100);
        setDocumentBlob(blob);
        setFileName(generatedFileName);
        setIsGenerating(false);

        toast({ title: "Protokoll klart!", description: "Du kan nu ladda ner ditt protokoll." });
      } catch (error) {
        console.error("Fel vid generering:", error);
        setIsGenerating(false);
        toast({ title: "Fel", description: "Kunde inte skapa protokollet.", variant: "destructive" });
      }
    };

    generateProtocol();
  }, [transcript, meetingName, navigate, toast]);

  const handleDownload = () => {
    if (documentBlob && fileName) {
      saveAs(documentBlob, fileName);
      toast({ title: "Nedladdning startad!", description: `${fileName} laddas ner nu.` });
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE');
  const timeStr = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} disabled={isGenerating}>
              <ArrowLeft />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">Mötesprotokoll</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isGenerating ? "Genererar protokoll..." : "Protokoll klart!"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        {isGenerating ? (
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Skapar ditt mötesprotokoll</h2>
              <p className="text-muted-foreground">AI analyserar och strukturerar innehållet...</p>
              <div className="w-full bg-muted rounded-full h-2 mt-4">
                <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {protocol && (
              <div className="max-w-2xl mx-auto mt-8 bg-card border border-border rounded-lg p-6 text-left space-y-4">
                <h3 className="font-semibold text-lg text-primary">{protocol.title}</h3>
                <p className="text-sm text-muted-foreground">{protocol.summary}</p>
                <div className="text-xs text-muted-foreground">
                  <p>✓ {protocol.mainPoints.length} huvudpunkter identifierade</p>
                  {protocol.decisions.length > 0 && <p>✓ {protocol.decisions.length} beslut dokumenterade</p>}
                  {protocol.actionItems.length > 0 && <p>✓ {protocol.actionItems.length} åtgärdspunkter</p>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{protocol?.title || meetingName}</CardTitle>
                <p className="text-sm text-muted-foreground">{dateStr} {timeStr}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {protocol && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-2">Sammanfattning</h3>
                      <p className="text-sm text-muted-foreground">{protocol.summary}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Huvudpunkter</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        {protocol.mainPoints.map((point, i) => <li key={i}>{point}</li>)}
                      </ul>
                    </div>
                    {protocol.decisions.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Beslut</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {protocol.decisions.map((decision, i) => <li key={i}>{decision}</li>)}
                        </ul>
                      </div>
                    )}
                    {protocol.actionItems.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Åtgärdspunkter</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {protocol.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button onClick={handleDownload} disabled={!documentBlob} className="flex-1">
                <Download className="mr-2 h-4 w-4" />Ladda ner .docx
              </Button>
              <Button onClick={() => setEmailDialogOpen(true)} variant="outline" disabled={!documentBlob} className="flex-1">
                <Mail className="mr-2 h-4 w-4" />Skicka via e-post
              </Button>
            </div>
          </div>
        )}
      </div>

      {documentBlob && fileName && (
        <EmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          documentBlob={documentBlob}
          fileName={fileName}
        />
      )}
    </div>
  );
}
