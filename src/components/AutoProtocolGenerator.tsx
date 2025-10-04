import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

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
  const [isComplete, setIsComplete] = useState(false);
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
        const fileName = `Motesprotokoll_${dateStr}_${timeStr.replace(':', '-')}.docx`;
        saveAs(blob, fileName);

        setIsGenerating(false);
        setIsComplete(true);

        toast({
          title: "Protokoll klart!",
          description: `${fileName} har laddats ner automatiskt.`,
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
                {isGenerating ? "Genererar protokoll..." : "Protokoll nedladdat!"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {isGenerating ? (
          <div className="text-center space-y-6">
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
              <div className="max-w-2xl mt-8 bg-card border border-border rounded-lg p-6 text-left space-y-4 animate-fade-in">
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
        ) : isComplete ? (
          <div className="text-center space-y-6 animate-scale-in">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-card-foreground">
                Klart!
              </h2>
              <p className="text-muted-foreground">
                Ditt mötesprotokoll har genererats och laddats ner
              </p>
            </div>

            <Button
              onClick={onBack}
              size="lg"
              className="mt-8"
            >
              Spela in nytt möte
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
