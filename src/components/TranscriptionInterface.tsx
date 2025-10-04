import { useState, useRef } from "react";
import { Mic, Square, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const TranscriptionInterface = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startAudioCapture = async () => {
    try {
      let stream: MediaStream;
      
      try {
        // @ts-ignore - Chrome experimentell funktion
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // @ts-ignore
            systemAudio: "include"
          }
        });
        console.log("Systemljud + mikrofon aktiverat");
      } catch (systemError) {
        console.log("Använder endast mikrofon");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      streamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Kunde inte starta ljudinspelning:", error);
      toast({
        title: "Fel",
        description: "Kunde inte komma åt mikrofonen eller systemljud",
        variant: "destructive",
      });
      throw error;
    }
  };

  const sendAudioToTranscribe = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      return new Promise<string>((resolve, reject) => {
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          
          try {
            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audio: base64Audio }
            });

            if (error) {
              console.error('Transkriberings-fel:', error);
              reject(error);
              return;
            }

            resolve(data.text || '');
          } catch (err) {
            console.error('Fel vid anrop till edge function:', err);
            reject(err);
          }
        };
        
        reader.onerror = () => reject(reader.error);
      });
    } catch (error) {
      console.error('Fel vid transkribering:', error);
      throw error;
    }
  };

  const startTest = async () => {
    try {
      setIsTesting(true);
      setTranscript("");
      audioChunksRef.current = [];

      const stream = await startAudioCapture();
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          toast({
            title: "Transkriberar...",
            description: "Bearbetar ljud...",
          });
          
          const transcribedText = await sendAudioToTranscribe(audioBlob);
          setTranscript(transcribedText);
          
          toast({
            title: "Test klart",
            description: "Mikrofonen fungerar!",
          });
        } catch (error) {
          console.error('Transkriberings-fel:', error);
          toast({
            title: "Transkribering misslyckades",
            description: "Kunde inte transkribera ljudet.",
            variant: "destructive",
          });
        }
        
        setIsTesting(false);
      };

      toast({
        title: "Test startat",
        description: "Säg något i 10 sekunder...",
      });

      mediaRecorder.start();

      testTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 10000);
    } catch (error) {
      console.error('Test error:', error);
      setIsTesting(false);
      toast({
        title: "Kunde inte starta test",
        description: "Kontrollera att du har gett mikrofontillstånd.",
        variant: "destructive",
      });
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setTranscript("");
      audioChunksRef.current = [];

      const stream = await startAudioCapture();
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);

      toast({
        title: "Inspelning startad",
        description: "Transkriberar mötet...",
      });

      // Skicka ljuddata var 5:e sekund för löpande transkribering
      intervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          
          try {
            const transcribedText = await sendAudioToTranscribe(audioBlob);
            if (transcribedText) {
              setTranscript(prev => prev + transcribedText + ' ');
            }
          } catch (error) {
            console.error('Transkriberings-fel:', error);
          }
        }
      }, 5000);

    } catch (error) {
      console.error('Recording error:', error);
      setIsRecording(false);
      toast({
        title: "Kunde inte starta inspelning",
        description: "Kontrollera att du har gett mikrofontillstånd.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsTesting(false);

    if (transcript) {
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
            Transkribera i realtid • Svenska • AI-driven med Gemini
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
            {!transcript ? (
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
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
