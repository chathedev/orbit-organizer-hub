import { TranscriptionInterface } from "@/components/TranscriptionInterface";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Laddar...</p>
        </div>
      </div>
    );
  }

  return <TranscriptionInterface />;
};

export default Index;
