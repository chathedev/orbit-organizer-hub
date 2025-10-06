import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Play, Clock, Calendar, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";

interface MeetingSession {
  id: string;
  transcript: string | null;
  interim_transcript: string | null;
  created_at: string;
  updated_at: string;
  is_paused: boolean | null;
}

const Library = () => {
  const { user, isLoading } = useAuth();
  const [sessions, setSessions] = useState<MeetingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;

    setLoading(true);
    
    // First, clean up only true duplicates (same minute AND empty)
    const { data: allSessions } = await supabase
      .from("meeting_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (allSessions && allSessions.length > 1) {
      // Group by minute to find duplicates
      const sessionsByMinute = new Map<string, typeof allSessions>();
      
      allSessions.forEach(session => {
        const minute = new Date(session.created_at).toISOString().slice(0, 16);
        const existing = sessionsByMinute.get(minute) || [];
        sessionsByMinute.set(minute, [...existing, session]);
      });

      // Find duplicates: multiple empty sessions in same minute
      const duplicateIds: string[] = [];
      sessionsByMinute.forEach((sessions) => {
        if (sessions.length > 1) {
          const emptySessions = sessions.filter(s => !s.transcript || s.transcript.trim() === '');
          // Keep the newest one, delete the rest
          if (emptySessions.length > 1) {
            emptySessions.slice(1).forEach(s => duplicateIds.push(s.id));
          }
        }
      });

      // Delete only actual duplicates
      if (duplicateIds.length > 0) {
        await supabase
          .from("meeting_sessions")
          .delete()
          .in("id", duplicateIds);
      }
    }

    // Load fresh list - but don't filter out empty sessions anymore
    // They might be actively being recorded
const { data, error } = await supabase
      .from("meeting_sessions")
      .select("*")
      .eq("user_id", user.id)
      .or("transcript.neq.,interim_transcript.neq.")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading sessions:", error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda möten",
        variant: "destructive",
      });
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  };

  const deleteSession = async (sessionId: string) => {
    const { error } = await supabase
      .from("meeting_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte ta bort mötet",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Borttaget",
        description: "Mötet har tagits bort",
      });
      loadSessions();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Laddar möten...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Loggar in...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-card-foreground">Mina möten</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hantera och fortsätt dina inspelade möten
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Inga möten ännu</p>
            <Button onClick={() => navigate("/")}>Spela in ett möte</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card key={session.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">Möte</CardTitle>
                      <CardDescription className="mt-2 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(session.updated_at)}
                        </span>
                        {session.is_paused && (
                          <span className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded text-xs font-medium">
                            Pausad
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {session.transcript || session.interim_transcript || "Ingen transkription ännu..."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate("/?session=" + session.id)}
                      size="sm"
                      variant="default"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Fortsätt
                    </Button>
                    <Button
                      onClick={() => deleteSession(session.id)}
                      size="sm"
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Ta bort
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Library;
