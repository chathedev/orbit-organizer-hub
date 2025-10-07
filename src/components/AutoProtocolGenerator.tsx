import { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { EmailDialog } from "./EmailDialog";

interface AIProtocol {
  title: string;
  summary: string;
  mainPoints: string[];
  decisions: string[];
  actionItems: string[];
}

interface AutoProtocolGeneratorProps {
  transcript: string;
  aiProtocol: AIProtocol | null;
  onBack: () => void;
}

export const AutoProtocolGenerator = ({ transcript, aiProtocol, onBack }: AutoProtocolGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(true);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const generateDocument = async () => {
      try {
        // Wait a moment to show loading state
        await new Promise(resolve => setTimeout(resolve, 1000));

        const now = new Date();
        const dateStr = now.toLocaleDateString('sv-SE');
        const timeStr = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

        // Use AI protocol if available, otherwise create simple protocol
        const title = aiProtocol?.title || `Mötesprotokoll ${dateStr}`;
        
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
                      text: title,
                      bold: true,
                      size: 32,
                    }),
                  ],
                  spacing: { after: 300 },
                }),

                // Date and time
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Datum: ",
                      bold: true,
                    }),
                    new TextRun(dateStr),
                    new TextRun({
                      text: " | Tid: ",
                      bold: true,
                    }),
                    new TextRun(timeStr),
                  ],
                  spacing: { after: 300 },
                }),

                // Divider
                new Paragraph({
                  text: "─────────────────────────────────────────",
                  spacing: { after: 300 },
                }),

                // AI-generated content (if available)
                ...(aiProtocol ? [
                  // Summary
                  new Paragraph({
                    text: "Sammanfattning",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 200 },
                  }),
                  new Paragraph({
                    text: aiProtocol.summary,
                    spacing: { after: 300 },
                  }),

                  // Main Points
                  new Paragraph({
                    text: "Huvudpunkter",
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 200, after: 200 },
                  }),
                  ...aiProtocol.mainPoints.map(point => 
                    new Paragraph({
                      text: `• ${point}`,
                      spacing: { after: 100 },
                    })
                  ),

                  // Decisions (if any)
                  ...(aiProtocol.decisions.length > 0 ? [
                    new Paragraph({
                      text: "Beslut",
                      heading: HeadingLevel.HEADING_1,
                      spacing: { before: 300, after: 200 },
                    }),
                    ...aiProtocol.decisions.map(decision => 
                      new Paragraph({
                        text: `• ${decision}`,
                        spacing: { after: 100 },
                      })
                    ),
                  ] : []),

                  // Action Items (if any)
                  ...(aiProtocol.actionItems.length > 0 ? [
                    new Paragraph({
                      text: "Åtgärdspunkter",
                      heading: HeadingLevel.HEADING_1,
                      spacing: { before: 300, after: 200 },
                    }),
                    ...aiProtocol.actionItems.map(item => 
                      new Paragraph({
                        text: `• ${item}`,
                        spacing: { after: 100 },
                      })
                    ),
                  ] : []),

                  // Divider before transcript
                  new Paragraph({
                    text: "─────────────────────────────────────────",
                    spacing: { before: 400, after: 300 },
                  }),
                ] : []),

                // Transcript heading
                new Paragraph({
                  text: "Fullständig transkription",
                  heading: HeadingLevel.HEADING_1,
                  spacing: { before: 200, after: 200 },
                }),

                // Transcript content
                new Paragraph({
                  text: transcript,
                  spacing: { after: 200 },
                }),
              ],
            },
          ],
        });

        const blob = await Packer.toBlob(doc);
        const generatedFileName = `Motesprotokoll_${dateStr}_${timeStr.replace(':', '-')}.docx`;
        
        setDocumentBlob(blob);
        setFileName(generatedFileName);
        setIsGenerating(false);

        toast({
          title: "Protokoll klart!",
          description: "Du kan nu se och ladda ner ditt protokoll.",
        });
      } catch (error) {
        console.error("Fel vid generering av protokoll:", error);
        setIsGenerating(false);
        toast({
          title: "Fel",
          description: "Kunde inte skapa protokollet.",
          variant: "destructive",
        });
      }
    };

    generateDocument();
  }, [transcript, aiProtocol, toast]);

  const handleDownload = () => {
    if (documentBlob && fileName) {
      saveAs(documentBlob, fileName);
      toast({
        title: "Nedladdning startad!",
        description: `${fileName} laddas ner nu.`,
      });
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE');
  const timeStr = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} disabled={isGenerating}>
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

      {/* Content */}
      <div className="flex-1 p-8">
        {isGenerating ? (
          <div className="text-center space-y-6 max-w-4xl mx-auto">
            <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-card-foreground">
                Skapar ditt mötesprotokoll
              </h2>
              <p className="text-muted-foreground">
                {aiProtocol ? "AI analyserar och strukturerar innehållet..." : "Förbereder transkriptionen..."}
              </p>
            </div>

            {/* Preview of AI content */}
            {aiProtocol && (
              <div className="max-w-2xl mx-auto mt-8 bg-card border border-border rounded-lg p-6 text-left space-y-4 animate-fade-in">
                <h3 className="font-semibold text-lg text-primary">{aiProtocol.title}</h3>
                <p className="text-sm text-muted-foreground">{aiProtocol.summary}</p>
                <div className="text-xs text-muted-foreground">
                  <p>✓ {aiProtocol.mainPoints.length} huvudpunkter identifierade</p>
                  {aiProtocol.decisions.length > 0 && (
                    <p>✓ {aiProtocol.decisions.length} beslut dokumenterade</p>
                  )}
                  {aiProtocol.actionItems.length > 0 && (
                    <p>✓ {aiProtocol.actionItems.length} åtgärdspunkter</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header with download button */}
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-card-foreground">Protokoll klart!</h2>
              <Button onClick={handleDownload} size="lg" className="gap-2">
                <Download className="w-5 h-5" />
                Ladda ner .docx
              </Button>
            </div>

            {/* Protocol Preview */}
            <Card>
              <CardHeader className="text-center border-b">
                <CardTitle className="text-2xl">MÖTESPROTOKOLL</CardTitle>
                <h3 className="text-xl font-bold mt-2">{aiProtocol?.title || `Mötesprotokoll ${dateStr}`}</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="font-semibold">Datum:</span> {dateStr} | <span className="font-semibold">Tid:</span> {timeStr}
                </p>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {aiProtocol && (
                  <>
                    {/* Summary */}
                    <div>
                      <h4 className="text-lg font-bold mb-2">Sammanfattning</h4>
                      <p className="text-muted-foreground">{aiProtocol.summary}</p>
                    </div>

                    {/* Main Points */}
                    <div>
                      <h4 className="text-lg font-bold mb-2">Huvudpunkter</h4>
                      <ul className="space-y-2">
                        {aiProtocol.mainPoints.map((point, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span className="text-muted-foreground">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Decisions */}
                    {aiProtocol.decisions.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold mb-2">Beslut</h4>
                        <ul className="space-y-2">
                          {aiProtocol.decisions.map((decision, index) => (
                            <li key={index} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <span className="text-muted-foreground">{decision}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Items */}
                    {aiProtocol.actionItems.length > 0 && (
                      <div>
                        <h4 className="text-lg font-bold mb-2">Åtgärdspunkter</h4>
                        <ul className="space-y-2">
                          {aiProtocol.actionItems.map((item, index) => (
                            <li key={index} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <span className="text-muted-foreground">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  </>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button onClick={onBack} variant="outline" size="lg">
                Spela in nytt möte
              </Button>
              <Button onClick={() => setEmailDialogOpen(true)} variant="outline" size="lg" className="gap-2">
                <Mail className="w-5 h-5" />
                Skicka via e-post
              </Button>
              <Button onClick={handleDownload} size="lg" className="gap-2">
                <Download className="w-5 h-5" />
                Ladda ner igen
              </Button>
            </div>

            {/* Email Dialog */}
            {documentBlob && (
              <EmailDialog
                open={emailDialogOpen}
                onOpenChange={setEmailDialogOpen}
                documentBlob={documentBlob}
                fileName={fileName}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
