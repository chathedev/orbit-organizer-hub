import { useState, useEffect } from "react";
import { Mic, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RecordingView } from "./RecordingView";
import { AutoProtocolGenerator } from "./AutoProtocolGenerator";
import { useLocation } from "react-router-dom";

type View = "welcome" | "recording" | "protocol";

interface AIProtocol {
  title: string;
  summary: string;
  mainPoints: string[];
  decisions: string[];
  actionItems: string[];
}

export const TranscriptionInterface = () => {
  const location = useLocation();
  const [currentView, setCurrentView] = useState<View>("welcome");
  const [transcript, setTranscript] = useState("");
  const [aiProtocol, setAiProtocol] = useState<AIProtocol | null>(null);

  // Check for session parameter on mount and auto-start
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session')) {
      setCurrentView("recording");
    }
  }, []);

  // Check for protocol data from library
  useEffect(() => {
    if (location.state?.showProtocol) {
      setTranscript(location.state.transcript);
      setAiProtocol(location.state.aiProtocol);
      setCurrentView("protocol");
    }
  }, [location]);

  const handleStartRecording = () => {
    setCurrentView("recording");
  };

  const handleFinishRecording = (data: { transcript: string; aiProtocol: AIProtocol | null }) => {
    setTranscript(data.transcript);
    setAiProtocol(data.aiProtocol);
    setCurrentView("protocol");
  };

  const handleBackToWelcome = () => {
    setCurrentView("welcome");
    setTranscript("");
    setAiProtocol(null);
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
      <AutoProtocolGenerator
        transcript={transcript}
        aiProtocol={aiProtocol}
        onBack={handleBackToWelcome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
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
