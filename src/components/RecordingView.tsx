import { useState, useRef, useEffect } from "react";
import { Square, FileText, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceVisualization } from "./VoiceVisualization";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isGeneratingProtocol, setIsGeneratingProtocol] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCreatedRef = useRef(false); // Prevent duplicate creation
  const { toast } = useToast();
  const { user } = useAuth();

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
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptText + ' ';
        } else {
          interim += transcriptText;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
        setInterimTranscript('');
      }
      
      if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onend = () => {
      console.log('Recognition ended, restarting...');
      if (isRecording && !isPaused && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error restarting recognition:', error);
        }
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
  }, [toast, isPaused]);

  // Auto-save session to database
  useEffect(() => {
    if (!user || !sessionId) return;

    // Debounce saving to avoid too many writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('meeting_sessions')
        .update({
          transcript,
          interim_transcript: interimTranscript,
          is_paused: isPaused,
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error saving session:', error);
      }
    }, 2000); // Save after 2 seconds of no changes

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [transcript, interimTranscript, isPaused, sessionId, user]);

  // Load or create session ONCE when component mounts
  useEffect(() => {
    const initSession = async () => {
      if (!user || sessionCreatedRef.current) return;
      
      sessionCreatedRef.current = true;
      setIsLoadingSession(true);

      try {
        // Check URL params for existing session ID
        const urlParams = new URLSearchParams(window.location.search);
        const existingSessionId = urlParams.get('session');

        if (existingSessionId) {
          // Load specific session from library
          const { data: existingSession, error } = await supabase
            .from('meeting_sessions')
            .select('*')
            .eq('id', existingSessionId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && existingSession) {
            setSessionId(existingSession.id);
            setTranscript(existingSession.transcript || '');
            setInterimTranscript(existingSession.interim_transcript || '');
            setIsPaused(existingSession.is_paused || false);
            toast({
              title: "Session återställd",
              description: "Fortsätter från ditt tidigare möte.",
            });
            // Clear the URL param
            window.history.replaceState({}, '', '/');
            setIsLoadingSession(false);
            return;
          }
        }

        // Clean up any empty duplicate sessions before creating new one
        const { data: existingSessions } = await supabase
          .from('meeting_sessions')
          .select('id, transcript, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        // Delete empty sessions created in the last minute (likely duplicates)
        if (existingSessions) {
          const now = new Date();
          const recentEmptySessions = existingSessions.filter(session => {
            const createdAt = new Date(session.created_at);
            const ageInSeconds = (now.getTime() - createdAt.getTime()) / 1000;
            return (!session.transcript || session.transcript.trim() === '') && ageInSeconds < 60;
          });

          if (recentEmptySessions.length > 0) {
            await supabase
              .from('meeting_sessions')
              .delete()
              .in('id', recentEmptySessions.map(s => s.id));
          }
        }

        // Create new session
        const { data: newSession, error } = await supabase
          .from('meeting_sessions')
          .insert({
            user_id: user.id,
            transcript: '',
            interim_transcript: '',
            is_paused: false,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating session:', error);
          toast({
            title: "Fel",
            description: "Kunde inte skapa session",
            variant: "destructive",
          });
          onBack();
        } else {
          setSessionId(newSession.id);
        }
      } catch (error) {
        console.error('Session init error:', error);
        toast({
          title: "Fel",
          description: "Kunde inte starta session",
          variant: "destructive",
        });
        onBack();
      } finally {
        setIsLoadingSession(false);
      }
    };

    initSession();
  }, [user, toast, onBack]);

  useEffect(() => {
    if (isLoadingSession || !sessionId) return;

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
        
        if (recognitionRef.current && !isPaused) {
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

  const togglePause = () => {
    if (isPaused) {
      // Resume
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error resuming recognition:', error);
        }
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      setIsPaused(false);
    } else {
      // Pause and mute
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      setIsPaused(true);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    
    // Save final state before stopping
    if (user && sessionId) {
      await supabase
        .from('meeting_sessions')
        .update({
          transcript,
          interim_transcript: interimTranscript,
          is_paused: false,
        })
        .eq('id', sessionId);
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    const fullTranscript = transcript + interimTranscript;
    
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

  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Förbereder inspelning...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-card-foreground">
            {isPaused ? "Möte pausat" : "Spelar in möte"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isPaused ? "Tryck återuppta för att fortsätta" : "Prata fritt • Texten visas direkt i realtid"}
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
          {transcript || interimTranscript ? (
            <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {transcript}
              <span className="opacity-60">{interimTranscript}</span>
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
            onClick={togglePause}
            size="lg"
            variant="secondary"
            className="px-8"
            disabled={isGeneratingProtocol}
          >
            {isPaused ? (
              <>
                <Play className="mr-2" />
                Återuppta
              </>
            ) : (
              <>
                <Pause className="mr-2" />
                Pausa
              </>
            )}
          </Button>
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
          <div className={`w-3 h-3 bg-primary rounded-full ${!isPaused && 'animate-pulse'}`} />
          <span className="text-sm font-medium text-primary">
            {isGeneratingProtocol ? "Genererar detaljerat protokoll med AI..." : isPaused ? "Pausad (mikrofon avstängd)" : "Spelar in..."}
          </span>
        </div>
      </div>
    </div>
  );
};
