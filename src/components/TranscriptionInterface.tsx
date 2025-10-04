import { useState } from "react";
import { Mic, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RecordingView } from "./RecordingView";
import { ProtocolGenerator } from "./ProtocolGenerator";

type View = "welcome" | "recording" | "protocol";

export const TranscriptionInterface = () => {
  const [currentView, setCurrentView] = useState<View>("welcome");
  const [transcript, setTranscript] = useState("");

  const handleStartRecording = () => {
    setCurrentView("recording");
  };

  const handleFinishRecording = (recordedTranscript: string) => {
    setTranscript(recordedTranscript);
    setCurrentView("protocol");
  };

  const handleBackToWelcome = () => {
    setCurrentView("welcome");
    setTranscript("");
  };

  if (currentView === "recording") {
    return (
      <RecordingView
        onFinish={handleFinishRecording}
        onBack={handleBackToWelcome}
      />
    );
  }

  if (currentView === "protocol") {
    return (
      <ProtocolGenerator
        transcript={transcript}
        onBack={handleBackToWelcome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-card-foreground">Mötestranskribering</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Transkribera i realtid • Svenska • Inget sparas
          </p>
        </div>
      </div>

      {/* Alert about browser compatibility */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>OBS:</strong> Denna funktion fungerar endast i Google Chrome webbläsare.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl text-center space-y-8">
          <div>
            <Mic className="w-24 h-24 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-card-foreground mb-4">
              Välkommen till mötestranskribering
            </h2>
            <p className="text-muted-foreground text-lg">
              Transkribera dina möten i realtid med svensk taligenkänning. 
              Skapa professionella mötesprotokoll snabbt och enkelt.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleStartRecording}
              size="lg"
              className="px-12 py-6 text-lg"
            >
              <Mic className="mr-2 h-6 w-6" />
              Spela in möte
            </Button>

            <div className="text-sm text-muted-foreground">
              <ul className="space-y-2">
                <li>✓ Realtidstranskribering på svenska</li>
                <li>✓ Animerad röstvisualisering</li>
                <li>✓ Generera och ladda ner Word-protokoll</li>
                <li>✓ Ingen data sparas</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
