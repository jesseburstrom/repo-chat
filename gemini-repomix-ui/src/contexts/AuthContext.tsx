// gemini-repomix-ui/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User, AuthChangeEvent, AuthError, Subscription } from '@supabase/supabase-js'; // Import Subscription
import { supabase } from '../supabaseClient';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    error: AuthError | null;
    signInWithEmail: (email: string, password: string) => Promise<any>;
    signUpWithEmail: (email: string, password: string) => Promise<any>;
    signInWithGitHub: () => Promise<any>; // Example OAuth
    signOut: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<AuthError | null>(null);

    useEffect(() => {
        setIsLoading(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Correctly type the return of onAuthStateChange
        const { data: { subscription } } : { data: { subscription: Subscription } } = supabase.auth.onAuthStateChange(
            async (_event: AuthChangeEvent, session: Session | null) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);
            }
        );

        return () => {
            // Now call unsubscribe on the subscription object
            subscription?.unsubscribe();
        };
    }, []);

    const signInWithEmail = async (email: string, password: string) => {
        setIsLoading(true);
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error); else setError(null);
        setIsLoading(false);
        return { error, data };
    };

    const signUpWithEmail = async (email: string, password: string) => {
        setIsLoading(true);
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) setError(error); else setError(null);
        setIsLoading(false);
        return { error, data };
    };

    const signInWithGitHub = async () => { // Example for GitHub OAuth
        setIsLoading(true);
        const { error, data } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: window.location.origin + '/repochat/' // Or your specific callback page
            }
        });
        if (error) setError(error); else setError(null);
        setIsLoading(false);
        return { error, data };
    };

    const signOut = async () => {
        setIsLoading(true);
        const { error } = await supabase.auth.signOut();
        if (error) setError(error); else setError(null);
        setIsLoading(false);
        return { error };
    };

    const value = {
        session,
        user,
        isLoading,
        error,
        signInWithEmail,
        signUpWithEmail,
        signInWithGitHub,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};