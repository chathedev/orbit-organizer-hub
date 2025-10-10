import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Play, Calendar, Trash2, FolderPlus, X, Edit2, Check, Folder, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Meeting {
  id: string;
  name: string;
  folder: string;
  transcript: string;
  interim_transcript: string;
  is_paused: boolean;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

const Library = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("Alla");
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [generatingProtocolId, setGeneratingProtocolId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load meetings
    const { data: meetingsData } = await supabase
      .from('meeting_sessions')
      .select('*')
      .not('transcript', 'is', null)
      .neq('transcript', '')
      .order('updated_at', { ascending: false });
    
    if (meetingsData) {
      setMeetings(meetingsData);
    }

    // Load folders
    const { data: foldersData } = await supabase
      .from('meeting_folders')
      .select('name')
      .order('name');
    
    if (foldersData) {
      setFolders(foldersData.map(f => f.name));
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    await supabase.from('meeting_sessions').delete().eq('id', id);
    toast({
      title: "Borttaget",
      description: "Mötet har tagits bort",
    });
    loadData();
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    
    const { error } = await supabase
      .from('meeting_folders')
      .insert({ name: newFolderName });
    
    if (error) {
      toast({
        title: "Fel",
        description: "Mappen finns redan",
        variant: "destructive",
      });
      return;
    }

    setNewFolderName("");
    setIsAddingFolder(false);
    loadData();
    toast({
      title: "Mapp skapad",
      description: `Mappen "${newFolderName}" har skapats`,
    });
  };

  const handleDeleteFolder = async (folder: string) => {
    if (folder === "Allmänt") {
      toast({
        title: "Kan inte ta bort",
        description: "Standardmappen kan inte tas bort",
        variant: "destructive",
      });
      return;
    }

    // Move meetings to Allmänt
    await supabase
      .from('meeting_sessions')
      .update({ folder: 'Allmänt' })
      .eq('folder', folder);

    // Delete folder
    await supabase
      .from('meeting_folders')
      .delete()
      .eq('name', folder);

    loadData();
    toast({
      title: "Mapp borttagen",
      description: "Möten flyttades till Allmänt",
    });
  };

  const handleStartEdit = (meeting: Meeting) => {
    setEditingMeetingId(meeting.id);
    setEditName(meeting.name);
  };

  const handleSaveEdit = async (meeting: Meeting) => {
    if (!editName.trim()) {
      setEditName(meeting.name);
      setEditingMeetingId(null);
      return;
    }

    await supabase
      .from('meeting_sessions')
      .update({ name: editName })
      .eq('id', meeting.id);

    setEditingMeetingId(null);
    loadData();
    toast({
      title: "Sparat",
      description: "Mötesnamnet har uppdaterats",
    });
  };

  const handleMoveToFolder = async (meeting: Meeting, newFolder: string) => {
    await supabase
      .from('meeting_sessions')
      .update({ folder: newFolder })
      .eq('id', meeting.id);

    loadData();
    toast({
      title: "Flyttat",
      description: `Mötet har flyttats till "${newFolder}"`,
    });
  };

  const handleGenerateProtocol = async (meeting: Meeting) => {
    setGeneratingProtocolId(meeting.id);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-meeting-protocol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcript: meeting.transcript }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate protocol');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Navigate to protocol view with the generated data
      navigate('/', { 
        state: { 
          showProtocol: true,
          transcript: meeting.transcript,
          aiProtocol: data.protocol 
        } 
      });
    } catch (error) {
      console.error('Protocol generation failed:', error);
      toast({
        title: "Fel",
        description: "Kunde inte generera protokoll. Försök igen.",
        variant: "destructive",
      });
    } finally {
      setGeneratingProtocolId(null);
    }
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredMeetings = selectedFolder === "Alla" 
    ? meetings 
    : meetings.filter(m => m.folder === selectedFolder);

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
        {/* Folder Management */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={selectedFolder === "Alla" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFolder("Alla")}
            >
              Alla möten ({meetings.length})
            </Button>
            {folders.map(folder => (
              <div key={folder} className="flex items-center gap-1">
                <Button
                  variant={selectedFolder === folder ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFolder(folder)}
                >
                  <Folder className="w-3 h-3 mr-1" />
                  {folder} ({meetings.filter(m => m.folder === folder).length})
                </Button>
                {folder !== "Allmänt" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFolder(folder)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {isAddingFolder ? (
            <div className="flex gap-2">
              <Input
                placeholder="Mappnamn..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFolder()}
                autoFocus
              />
              <Button onClick={handleAddFolder} size="sm">
                <Check className="w-4 h-4" />
              </Button>
              <Button onClick={() => {
                setIsAddingFolder(false);
                setNewFolderName("");
              }} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={() => setIsAddingFolder(true)} variant="outline" size="sm">
              <FolderPlus className="w-4 h-4 mr-2" />
              Ny mapp
            </Button>
          )}
        </div>

        {/* Meetings List */}
        {filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {selectedFolder === "Alla" ? "Inga möten ännu" : `Inga möten i "${selectedFolder}"`}
            </p>
            <Button onClick={() => navigate("/")}>Spela in ett möte</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredMeetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {editingMeetingId === meeting.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(meeting)}
                            autoFocus
                          />
                          <Button onClick={() => handleSaveEdit(meeting)} size="sm">
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button onClick={() => setEditingMeetingId(null)} variant="ghost" size="sm">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{meeting.name}</CardTitle>
                          <Button
                            onClick={() => handleStartEdit(meeting)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      <CardDescription className="mt-2 flex items-center gap-4 text-xs flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(meeting.updated_at)}
                        </span>
                        <span>
                          {formatDuration(meeting.duration_seconds)}
                        </span>
                        {meeting.is_paused && (
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
                    {meeting.transcript || meeting.interim_transcript || "Ingen transkription ännu..."}
                  </p>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Button
                      onClick={() => navigate("/?session=" + meeting.id + "#auto")}
                      size="sm"
                      variant="default"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Fortsätt
                    </Button>
                    <Button
                      onClick={() => handleGenerateProtocol(meeting)}
                      size="sm"
                      variant="secondary"
                      disabled={generatingProtocolId === meeting.id}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      {generatingProtocolId === meeting.id ? "Genererar..." : "Skapa protokoll"}
                    </Button>
                    <Button
                      onClick={() => navigate('/transcript', { state: { meeting } })}
                      size="sm"
                      variant="outline"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Visa transkription
                    </Button>
                    <Select value={meeting.folder} onValueChange={(value) => handleMoveToFolder(meeting, value)}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map(folder => (
                          <SelectItem key={folder} value={folder}>
                            <div className="flex items-center gap-2">
                              <Folder className="w-3 h-3" />
                              {folder}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => handleDeleteMeeting(meeting.id)}
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
