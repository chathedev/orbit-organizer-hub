import { useState, useRef, useEffect } from "react";
import { Square, FileText, Pause, Play, Edit2, Check, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceVisualization } from "./VoiceVisualization";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState as useStateHook, useEffect as useEffectHook } from "react";

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
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isGeneratingProtocol, setIsGeneratingProtocol] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [meetingName, setMeetingName] = useState("Namnlöst möte");
  const [selectedFolder, setSelectedFolder] = useState("Allmänt");
  const [isEditingName, setIsEditingName] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [shouldStartRecording, setShouldStartRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);
  const isMutedRef = useRef(false);
  const isRecordingRef = useRef(false);
const { toast } = useToast();

  // Keep refs in sync with state to avoid stale closures
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

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
      // Ignore any results when paused or muted; clear interim immediately
      if (isPausedRef.current || isMutedRef.current) {
        setInterimTranscript('');
        return;
      }
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
        setHasSpoken(true);
      }
      
      if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onend = () => {
      console.log('Recognition ended');
      // Only restart if we're actually still recording and not paused/muted
      if (isRecordingRef.current && !isPausedRef.current && !isMutedRef.current && recognitionRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(() => {
          try {
            // Double check state before restarting
            if (isRecordingRef.current && !isPausedRef.current && !isMutedRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (error) {
            console.error('Error restarting recognition:', error);
          }
        }, 100);
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
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, [toast, isPaused, isMuted, isRecording]);

  // Load available folders
  const [folders, setFolders] = useState<string[]>([]);
  
  useEffect(() => {
    const loadFolders = async () => {
      const { data } = await supabase.from('meeting_folders').select('name').order('name');
      if (data) {
        setFolders(data.map(f => f.name));
      }
    };
    loadFolders();
  }, []);

  // Auto-save to database
  useEffect(() => {
    if (!sessionId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('meeting_sessions')
        .update({
          name: meetingName,
          folder: selectedFolder,
          transcript,
          interim_transcript: interimTranscript,
          is_paused: isPaused,
          duration_seconds: durationSec,
        })
        .eq('id', sessionId);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [transcript, interimTranscript, isPaused, durationSec, sessionId, meetingName, selectedFolder]);

  // Load or create session from database
  useEffect(() => {
    const initSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const existingSessionId = urlParams.get('session');

      if (existingSessionId) {
        const { data: existing } = await supabase
          .from('meeting_sessions')
          .select('*')
          .eq('id', existingSessionId)
          .single();
          
        if (existing) {
          setSessionId(existing.id);
          setMeetingName(existing.name || 'Namnlöst möte');
          setSelectedFolder(existing.folder || 'Allmänt');
          setTranscript(existing.transcript || '');
          setInterimTranscript(existing.interim_transcript || '');
          setIsPaused(false); // Auto-start when continuing
          setDurationSec(existing.duration_seconds || 0);
          setShouldStartRecording(true); // Flag to auto-start
          toast({
            title: "Möte återställt",
            description: `Fortsätter "${existing.name}"`,
          });
          window.history.replaceState({}, '', '/');
          return;
        }
      }

      // Create new session and auto-start
      const { data: newSession } = await supabase
        .from('meeting_sessions')
        .insert({
          name: 'Namnlöst möte',
          folder: 'Allmänt',
          transcript: '',
          interim_transcript: '',
          is_paused: false,
        })
        .select()
        .single();
        
      if (newSession) {
        setSessionId(newSession.id);
        setShouldStartRecording(true);
      }
    };

    initSession();
  }, [toast]);

  useEffect(() => {
    if (!sessionId || !shouldStartRecording) return;

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
        
        // Request wake lock to keep screen on
        if ('wakeLock' in navigator) {
          try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('Wake Lock activated');
          } catch (err) {
            console.log('Wake Lock error:', err);
          }
        }
        
        if (recognitionRef.current && !isPaused && !isMuted) {
          recognitionRef.current.start();
          setIsRecording(true);
          isRecordingRef.current = true;
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
        try {
          recognitionRef.current.stop();
          if (recognitionRef.current.abort) recognitionRef.current.abort();
        } catch (e) {}
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
      isRecordingRef.current = false;
    };
  }, [sessionId, shouldStartRecording, isPaused, isMuted, toast, onBack]);

  // Track duration while recording
  useEffect(() => {
    if (isRecording && !isPaused) {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
    } else {
      if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    }
    return () => {
      if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    };
  }, [isRecording, isPaused]);


  const togglePause = () => {
    if (isPaused) {
      // Resume
      isPausedRef.current = false;
      setIsPaused(false);
      if (streamRef.current && !isMutedRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      if (recognitionRef.current && !isMutedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error resuming recognition:', error);
        }
      }
    } else {
      // Pause immediately
      isPausedRef.current = true;
      setIsPaused(true);
      setInterimTranscript(''); // Clear interim immediately
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          if (recognitionRef.current.abort) recognitionRef.current.abort(); // Force immediate stop
        } catch (error) {
          console.error('Error pausing recognition:', error);
        }
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      // Unmute
      isMutedRef.current = false;
      setIsMuted(false);
      if (streamRef.current && !isPausedRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      if (recognitionRef.current && !isPausedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error starting recognition:', error);
        }
      }
      toast({
        title: "Mikrofon påslagen",
        description: "Transkribering återupptas",
      });
    } else {
      // Mute immediately - stop transcription completely
      isMutedRef.current = true;
      setIsMuted(true);
      setInterimTranscript(''); // Clear interim immediately
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          if (recognitionRef.current.abort) recognitionRef.current.abort(); // Force immediate stop
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      toast({
        title: "Mikrofon tystad",
        description: "Transkribering stoppad",
      });
    }
  };

  const saveToLibrary = async () => {
    const fullTranscript = transcript + interimTranscript;
    
    if (!fullTranscript.trim()) {
      toast({
        title: "Ingen text",
        description: "Ingen transkription inspelad än.",
        variant: "destructive",
      });
      return;
    }
    
    // Save to database
    const { error } = await supabase
      .from('meeting_sessions')
      .update({
        name: meetingName,
        folder: selectedFolder,
        transcript: fullTranscript,
        interim_transcript: '',
        is_paused: true,
        duration_seconds: durationSec,
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error saving to library:', error);
      toast({
        title: "Fel vid sparning",
        description: "Kunde inte spara till biblioteket. Försök igen.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sparat!",
        description: `"${meetingName}" har sparats i biblioteket under ${selectedFolder}.`,
      });
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        if (recognitionRef.current.abort) recognitionRef.current.abort();
      } catch (e) {}
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    const fullTranscript = transcript + interimTranscript;
    
    if (!fullTranscript.trim()) {
      if (sessionId) {
        await supabase.from('meeting_sessions').delete().eq('id', sessionId);
      }
      toast({
        title: "Ingen text",
        description: "Ingen transkription inspelad.",
        variant: "destructive",
      });
      onBack();
      return;
    }
    
    // Final save
    await supabase
      .from('meeting_sessions')
      .update({
        name: meetingName,
        folder: selectedFolder,
        transcript: fullTranscript,
        interim_transcript: '',
        is_paused: false,
        duration_seconds: durationSec,
      })
      .eq('id', sessionId);

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


  const getFoldersSync = () => folders;

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
        {/* Meeting Info */}
        <div className="w-full bg-card rounded-lg border border-border p-4 mb-6">
          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Mötesnamn</label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Input
                    value={meetingName}
                    onChange={(e) => setMeetingName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
                    autoFocus
                    className="h-9"
                  />
                  <Button onClick={() => setIsEditingName(false)} size="sm">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{meetingName}</span>
                  <Button
                    onClick={() => setIsEditingName(true)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div className="min-w-[160px]">
              <label className="text-xs text-muted-foreground mb-1 block">Mapp</label>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {folders.map(folder => (
                    <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Varaktighet</label>
              <span className="text-sm font-medium block">
                {Math.floor(durationSec / 60)}:{(durationSec % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

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
        <div className="flex gap-3 flex-wrap justify-center">
          <Button
            onClick={togglePause}
            size="lg"
            variant="secondary"
            className="px-6"
            disabled={isGeneratingProtocol}
          >
            {isPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Återuppta
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pausa
              </>
            )}
          </Button>
          <Button
            onClick={toggleMute}
            size="lg"
            variant="outline"
            className="px-6"
            disabled={isGeneratingProtocol || isPaused}
          >
            {isMuted ? (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Slå på ljud
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Tysta
              </>
            )}
          </Button>
          <Button
            onClick={saveToLibrary}
            size="lg"
            variant="default"
            className="px-6"
            disabled={isGeneratingProtocol || !hasSpoken || !isPaused}
          >
            <FileText className="mr-2 h-4 w-4" />
            Spara i bibliotek
          </Button>
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
            className="px-6"
            disabled={isGeneratingProtocol}
          >
            <Square className="mr-2 h-4 w-4" />
            {isGeneratingProtocol ? "Genererar..." : "Stoppa & skapa protokoll"}
          </Button>
        </div>

        {/* Recording indicator */}
        <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-md">
          <div className={`w-3 h-3 bg-primary rounded-full ${!isPaused && !isMuted && 'animate-pulse'}`} />
          <span className="text-sm font-medium text-primary">
            {isGeneratingProtocol 
              ? "Genererar detaljerat protokoll med AI..." 
              : isPaused 
              ? "Pausad (ingen transkription)" 
              : isMuted
              ? "Tystad (ingen transkription)"
              : "Spelar in..."}
          </span>
        </div>
      </div>
    </div>
  );
};
