import { useState, useRef, useEffect } from "react";
import { Square, FileText, Pause, Play, Edit2, Check, MicOff, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RecordingViewProps {
  onBack: () => void;
  continuedMeeting?: any;
}

export const RecordingView = ({ onBack, continuedMeeting }: RecordingViewProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(!!continuedMeeting);
  const [transcript, setTranscript] = useState(continuedMeeting?.transcript || "");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [sessionId, setSessionId] = useState<string>(continuedMeeting?.id || "");
  const [meetingName, setMeetingName] = useState(continuedMeeting?.title || "Namnlöst möte");
  const [selectedFolder, setSelectedFolder] = useState(continuedMeeting?.folder || "Allmänt");
  const [isEditingName, setIsEditingName] = useState(false);
  const [durationSec, setDurationSec] = useState(continuedMeeting?.duration_seconds || 0);
  const [showShortTranscriptDialog, setShowShortTranscriptDialog] = useState(false);
  const [showMaxDurationDialog, setShowMaxDurationDialog] = useState(false);
  const MAX_DURATION_SECONDS = 7200;
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecognitionActiveRef = useRef(false);
  const transcriptViewRef = useRef<HTMLDivElement>(null);
  const [folders, setFolders] = useState<string[]>(["Allmänt"]);

  useEffect(() => {
    const loadFolders = async () => {
      const { data } = await supabase.from('meeting_folders').select('name');
      if (data && data.length > 0) {
        setFolders(data.map(f => f.name));
      }
    };
    loadFolders();
  }, []);

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
      isRecognitionActiveRef.current = false;
      
      if (isRecording && !isPaused && !isMuted && recognitionRef.current) {
        setTimeout(() => {
          if (isRecording && !isPaused && !isMuted && recognitionRef.current && !isRecognitionActiveRef.current) {
            try {
              recognitionRef.current.start();
              isRecognitionActiveRef.current = true;
            } catch (error: any) {
              if (error.message?.includes('already started')) {
                isRecognitionActiveRef.current = true;
              }
            }
          }
        }, 100);
      }
    };

    recognition.onerror = (event: any) => {
      isRecognitionActiveRef.current = false;
      if (event.error === 'aborted') return;
      
      if (event.error === 'no-speech') {
        toast({ title: "Inget tal upptäckt", description: "Försök prata lite högre." });
      } else if (event.error === 'audio-capture') {
        toast({ title: "Mikrofonfel", description: "Kunde inte komma åt mikrofonen.", variant: "destructive" });
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [toast, isPaused, isMuted, isRecording]);

  useEffect(() => {
    if (!sessionId || !transcript.trim()) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('meeting_sessions')
        .upsert({
          id: sessionId,
          name: meetingName,
          folder: selectedFolder,
          transcript,
          interim_transcript: interimTranscript,
          duration_seconds: durationSec,
          updated_at: new Date().toISOString(),
        });
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [transcript, meetingName, selectedFolder, sessionId, durationSec, interimTranscript]);

  useEffect(() => {
    const el = transcriptViewRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript, interimTranscript]);

  useEffect(() => {
    const initSession = async () => {
      if (continuedMeeting) {
        setSessionId(continuedMeeting.id);
        setSelectedFolder(continuedMeeting.folder);
        return;
      }

      if (sessionId) return;

      const { data, error } = await supabase
        .from('meeting_sessions')
        .insert({
          name: 'Namnlöst möte',
          folder: 'Allmänt',
          transcript: '',
          interim_transcript: '',
        })
        .select()
        .single();

      if (data && !error) {
        setSessionId(data.id);
      }
    };

    initSession();
  }, [continuedMeeting, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

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
        
        if (recognitionRef.current && !isPaused && !isMuted && !isRecognitionActiveRef.current) {
          try {
            recognitionRef.current.start();
            isRecognitionActiveRef.current = true;
            setIsRecording(true);
          } catch (error: any) {
            if (error.message?.includes('already started')) {
              isRecognitionActiveRef.current = true;
            }
            setIsRecording(true);
          }
        } else {
          setIsRecording(true);
        }
      } catch (error) {
        toast({ title: "Fel", description: "Kunde inte komma åt mikrofonen", variant: "destructive" });
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
  }, [sessionId, isPaused, isMuted, toast, onBack, isRecording]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = setInterval(() => {
        setDurationSec((s) => {
          const newDuration = s + 1;
          if (newDuration >= MAX_DURATION_SECONDS) {
            setShowMaxDurationDialog(true);
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [isRecording, isPaused]);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (recognitionRef.current && !isRecognitionActiveRef.current) {
        setTimeout(() => {
          if (recognitionRef.current && !isRecognitionActiveRef.current && !isMuted) {
            try {
              recognitionRef.current.start();
              isRecognitionActiveRef.current = true;
            } catch (error: any) {
              if (error.message?.includes('already started')) {
                isRecognitionActiveRef.current = true;
              }
            }
          }
        }, 100);
      }
    } else {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        recognitionRef.current.stop();
        isRecognitionActiveRef.current = false;
      }
      setIsMuted(true);
    }
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      if (recognitionRef.current && !isMuted && !isRecognitionActiveRef.current) {
        setTimeout(() => {
          if (recognitionRef.current && !isMuted && !isRecognitionActiveRef.current && !isPaused) {
            try {
              recognitionRef.current.start();
              isRecognitionActiveRef.current = true;
            } catch (error: any) {
              if (error.message?.includes('already started')) {
                isRecognitionActiveRef.current = true;
              }
            }
          }
        }, 100);
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
    } else {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        recognitionRef.current.stop();
        isRecognitionActiveRef.current = false;
      }
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      setIsPaused(true);
    }
  };

  const saveToLibrary = async () => {
    const fullTranscript = transcript + interimTranscript;
    
    if (!fullTranscript.trim() || !sessionId) {
      toast({ title: "Ingen text", description: "Ingen transkription inspelad än.", variant: "destructive" });
      return;
    }
    
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      isRecognitionActiveRef.current = false;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    await supabase
      .from('meeting_sessions')
      .update({
        name: meetingName,
        folder: selectedFolder,
        transcript: fullTranscript,
        duration_seconds: durationSec,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
    
    toast({ title: "Sparat!", description: `"${meetingName}" har sparats i biblioteket.` });
    onBack();
  };

  const stopRecording = async () => {
    const fullTranscript = (transcript + interimTranscript).trim();

    if (!fullTranscript) {
      toast({ title: "Ingen text", description: "Ingen transkription inspelad.", variant: "destructive" });
      onBack();
      return;
    }

    const wordCount = fullTranscript.split(/\s+/).length;
    if (wordCount < 30) {
      setShowShortTranscriptDialog(true);
      return;
    }

    proceedToProtocol(fullTranscript);
  };

  const proceedToProtocol = async (fullTranscript: string) => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      isRecognitionActiveRef.current = false;
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(track => track.stop()); } catch {}
      streamRef.current = null;
    }

    await supabase
      .from('meeting_sessions')
      .update({
        name: meetingName,
        folder: selectedFolder,
        transcript: fullTranscript,
        duration_seconds: durationSec,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    navigate('/protocol', {
      state: {
        transcript: fullTranscript,
        meetingName,
        meetingId: sessionId,
      }
    });
  };

  const proceedWithShortTranscript = () => {
    setShowShortTranscriptDialog(false);
    proceedToProtocol(transcript + interimTranscript);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-28">
      <div className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Mötesinspelning</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {Math.floor(durationSec / 60)}:{(durationSec % 60).toString().padStart(2, '0')} • {(() => {
                  const combined = `${transcript} ${interimTranscript}`.trim();
                  return combined ? combined.split(/\s+/).length : 0;
                })()} ord
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${!isPaused && !isMuted ? 'bg-red-500 animate-pulse' : 'bg-muted'}`} />
              <span className="text-sm text-muted-foreground">
                {isMuted ? 'Avstängd' : isPaused ? 'Pausad' : 'Spelar in'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 md:p-6 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Mötesnamn</label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <Input
                    value={meetingName}
                    onChange={(e) => setMeetingName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditingName(false)}
                    autoFocus
                    className="h-8 text-sm"
                  />
                  <Button onClick={() => setIsEditingName(false)} size="sm" className="h-8">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{meetingName}</span>
                  <Button onClick={() => setIsEditingName(true)} variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Mapp</label>
              <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                <SelectTrigger className="h-8 text-sm">
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
              <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
              <div className="flex items-center gap-2 h-8">
                {(() => {
                  const combined = `${transcript} ${interimTranscript}`.trim();
                  const words = combined ? combined.split(/\s+/) : [];
                  const count = words.length;
                  if (count < 30) return <span className="text-xs text-yellow-600 dark:text-yellow-500">Behöver mer innehåll</span>;
                  if (count < 50) return <span className="text-xs text-blue-600 dark:text-blue-400">Bra längd</span>;
                  return <span className="text-xs text-green-600 dark:text-green-500">Utmärkt längd</span>;
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-card rounded-lg border border-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <h3 className="text-sm font-medium">Live-transkription</h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{(() => {
                const combined = `${transcript} ${interimTranscript}`.trim();
                return combined ? combined.split(/\s+/).length : 0;
              })()} ord</span>
              <span>{new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div ref={transcriptViewRef} className="flex-1 overflow-y-auto p-6">
            {transcript.trim() ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript.trim()}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Börja prata för att se texten här i realtid…</p>
            )}
            {interimTranscript && (
              <p className="text-sm leading-relaxed text-muted-foreground italic mt-2 animate-fade-in">
                {interimTranscript}<span className="opacity-50 ml-1">▍</span>
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-20 z-40 bg-background/95 backdrop-blur border-t border-border p-4 -mx-4 md:-mx-6">
          <div className="flex gap-2 flex-wrap justify-center max-w-3xl mx-auto">
            <Button onClick={toggleMute} size="default" variant={isMuted ? "destructive" : "outline"} className="flex-1 min-w-[140px]">
              {isMuted ? (
                <><MicOff className="mr-2 h-4 w-4" />Mikrofon av</>
              ) : (
                <><Mic className="mr-2 h-4 w-4" />Spelar in</>
              )}
            </Button>
            <Button onClick={togglePause} size="default" variant="outline" className="flex-1 min-w-[140px]" disabled={isMuted}>
              {isPaused ? (
                <><Play className="mr-2 h-4 w-4" />Återuppta</>
              ) : (
                <><Pause className="mr-2 h-4 w-4" />Pausa</>
              )}
            </Button>
            <Button onClick={saveToLibrary} size="default" variant="outline" className="flex-1 min-w-[140px]" disabled={!isPaused}>
              <FileText className="mr-2 h-4 w-4" />Spara
            </Button>
            <Button onClick={stopRecording} size="default" variant="destructive" className="flex-1 min-w-[200px]">
              <Square className="mr-2 h-4 w-4" />Stoppa & skapa protokoll
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showShortTranscriptDialog} onOpenChange={setShowShortTranscriptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kort transkription</AlertDialogTitle>
            <AlertDialogDescription>
              Din transkription är väldigt kort (under 30 ord). AI-protokollet fungerar bäst med 50+ ord.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowShortTranscriptDialog(false)}>Fortsätt spela in</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithShortTranscript}>Generera protokoll nu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMaxDurationDialog} onOpenChange={setShowMaxDurationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Maximal inspelningstid nådd</AlertDialogTitle>
            <AlertDialogDescription>Du har nått maximal inspelningstid på 2 timmar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setShowMaxDurationDialog(false); onBack(); }}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
