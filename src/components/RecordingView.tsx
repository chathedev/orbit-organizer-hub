import { useState, useRef, useEffect } from "react";
import { Square, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceVisualization } from "./VoiceVisualization";
import { useToast } from "@/hooks/use-toast";

interface AIProtocol {
  title: string;
  summary: string;
  mainPoints: string[];
  decisions: string[];
  actionItems: string[];
}

interface RecordingViewProps {
  onFinish: (data: { transcript: string; aiProtocol: AIProtocol | null }) => void;
  onBack: () => void;
}

export const RecordingView = ({ onFinish, onBack }: RecordingViewProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isGeneratingProtocol, setIsGeneratingProtocol] = useState(false);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: "Inte stödd",
        description: "Din webbläsare stöder inte rösttranskribering. Använd Google Chrome.",
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
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Taligenkänningsfel:', event.error);
      if (event.error === 'no-speech') {
        toast({
          title: "Inget tal upptäckt",
          description: "Försök prata lite högre.",
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
    const startRecording = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        streamRef.current = stream;
        
        if (recognitionRef.current) {
          recognitionRef.current.start();
          setIsRecording(true);
        }
      } catch (error) {
        console.error("Kunde inte starta inspelning:", error);
        toast({
          title: "Fel",
          description: "Kunde inte komma åt mikrofonen",
          variant: "destructive",
        });
        onBack();
      }
    };

    startRecording();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [toast, onBack]);

  const stopRecording = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    
    const fullTranscript = transcript;
    
    if (!fullTranscript.trim()) {
      toast({
        title: "Ingen text",
        description: "Ingen transkription inspelad.",
        variant: "destructive",
      });
      onBack();
      return;
    }

    // Generate AI protocol
    setIsGeneratingProtocol(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-meeting-protocol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcript: fullTranscript }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate protocol');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Pass AI-generated protocol to next view
      onFinish({ 
        transcript: fullTranscript, 
        aiProtocol: data.protocol 
      });
    } catch (error) {
      console.error('AI protocol generation failed:', error);
      
      toast({
        title: "AI-generering misslyckades",
        description: "Skapar enkelt protokoll med transkription...",
        variant: "default",
      });

      // Fallback: continue without AI protocol
      onFinish({ 
        transcript: fullTranscript, 
        aiProtocol: null 
      });
    } finally {
      setIsGeneratingProtocol(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-card-foreground">Spelar in möte</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prata fritt • Texten visas direkt i realtid
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center p-8 max-w-4xl mx-auto w-full">
        {/* Real-time transcript display */}
        <div className="w-full bg-card rounded-lg border border-border p-6 mb-8 min-h-[300px] max-h-[500px] overflow-y-auto">
          <h2 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Transkription (realtid)
          </h2>
          {transcript ? (
            <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {transcript}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic">
              Börja prata så visas texten här direkt...
            </p>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex gap-4">
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
            className="px-8"
            disabled={isGeneratingProtocol}
          >
            <Square className="mr-2" />
            {isGeneratingProtocol ? "Genererar AI-protokoll..." : "Stoppa & skapa protokoll"}
          </Button>
        </div>

        {/* Recording indicator */}
        <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-md">
          <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">
            {isGeneratingProtocol ? "Genererar detaljerat protokoll med AI..." : "Spelar in..."}
          </span>
        </div>
      </div>
    </div>
  );
};
