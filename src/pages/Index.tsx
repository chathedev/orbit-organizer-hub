import { useState } from "react";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { TranscriptionInterface } from "@/components/TranscriptionInterface";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const { toast } = useToast();

  const handlePermissionGranted = () => {
    setHasPermission(true);
  };

  const handlePermissionDenied = () => {
    toast({
      title: "Mikrofontillstånd krävs",
      description: "Vi behöver tillgång till din mikrofon för att transkribera. Uppdatera sidan och försök igen.",
      variant: "destructive",
    });
  };

  if (!hasPermission) {
    return (
      <WelcomeScreen 
        onPermissionGranted={handlePermissionGranted}
        onPermissionDenied={handlePermissionDenied}
      />
    );
  }

  return <TranscriptionInterface />;
};

export default Index;
