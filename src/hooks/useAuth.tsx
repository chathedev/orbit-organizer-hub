import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Check for existing session or sign in anonymously
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setSession(session);
        setUser(session.user);
      } else {
        // Auto sign in anonymously if no session exists
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Error signing in anonymously:', error);
        } else {
          setSession(data.session);
          setUser(data.user);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, isLoading };
};
