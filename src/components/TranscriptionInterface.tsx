import { useState, useRef, useEffect } from "react";
import { Mic, Square, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const TranscriptionInterface = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: "Inte stödd",
        description: "Din webbläsare stöder inte rösttranskribering. Använd Chrome eller Edge.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sv-SE';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptPart + ' ';
        } else {
          interim += transcriptPart;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Taligenkänningsfel:', event.error);
      if (event.error === 'no-speech') {
        toast({
          title: "Inget tal upptäckt",
          description: "Försök prata lite högre eller närmare mikrofonen.",
        });
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [toast]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimTranscript]);

  const startTest = () => {
    if (!recognitionRef.current) return;
    
    setIsTesting(true);
    setTranscript("");
    setInterimTranscript("");
    
    recognitionRef.current.start();
    
    toast({
      title: "Test startat",
      description: "Säg något för att testa mikrofonen (10 sekunder)",
    });

    testTimeoutRef.current = setTimeout(() => {
      stopRecording();
      setIsTesting(false);
      toast({
        title: "Test avslutat",
        description: "Mikrofonen fungerar! Klicka på 'Spela in möte' för att börja.",
      });
    }, 10000);
  };

  const startRecording = () => {
    if (!recognitionRef.current) return;
    
    setIsRecording(true);
    setTranscript("");
    setInterimTranscript("");
    
    recognitionRef.current.start();
    
    toast({
      title: "Inspelning startad",
      description: "Transkribering pågår...",
    });
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
    }
    
    setIsRecording(false);
    setIsTesting(false);
    
    if (transcript || interimTranscript) {
      toast({
        title: "Inspelning stoppad",
        description: "Transkriberingen är klar.",
      });
    }
  };

  const isActive = isRecording || isTesting;

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

      {/* Control Panel */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={startTest}
              disabled={isActive}
              variant="secondary"
              size="lg"
            >
              <TestTube className="mr-2" />
              Testa mikrofon
            </Button>

            {!isActive ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="bg-accent hover:bg-accent/90"
              >
                <Mic className="mr-2" />
                Spela in möte
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
              >
                <Square className="mr-2" />
                Stoppa
              </Button>
            )}

            {isActive && (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-md">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                <span className="text-sm font-medium text-primary">
                  {isTesting ? "Testar..." : "Spelar in..."}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transcript Display */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-6 h-full">
          <div className="bg-card border border-border rounded-lg p-6 h-full overflow-y-auto">
            {!transcript && !interimTranscript ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                  <Mic className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-muted-foreground">
                    Tryck på "Testa mikrofon" eller "Spela in möte" för att börja
                  </p>
                </div>
              </div>
            ) : (
              <div className="prose prose-lg max-w-none">
                <p className="text-card-foreground leading-relaxed whitespace-pre-wrap">
                  {transcript}
                  {interimTranscript && (
                    <span className="text-muted-foreground italic">
                      {interimTranscript}
                    </span>
                  )}
                </p>
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
