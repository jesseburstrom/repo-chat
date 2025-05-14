// gemini-repomix-ui/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User, AuthChangeEvent, AuthError, Subscription } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    error: AuthError | null;
    signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; data: any }>; // More specific return
    signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; data: any }>; // More specific return
    signInWithGitHub: () => Promise<{ error: AuthError | null; data: any }>; // More specific return
    signOut: () => Promise<{ error: AuthError | null }>; // More specific return
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<AuthError | null>(null);

    useEffect(() => {
        console.log('[AuthContext] Initializing: Setting isLoading to true.');
        setIsLoading(true);
        setError(null); // Clear any previous error on init

        // Get initial session
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            console.log('[AuthContext] Initial getSession result:', initialSession);
            setSession(initialSession);
            setUser(initialSession?.user ?? null);
            setIsLoading(false); // Set loading to false after initial session check
        }).catch(getSessionError => {
            console.error('[AuthContext] Error in initial getSession:', getSessionError);
            setError(getSessionError as AuthError); // Cast if necessary, or handle more gracefully
            setIsLoading(false);
        });

        // Set up auth state change listener
        const { data: { subscription } }: { data: { subscription: Subscription } } = supabase.auth.onAuthStateChange(
            async (_event: AuthChangeEvent, currentSession: Session | null) => {
                console.log('[AuthContext] onAuthStateChange triggered. Event:', _event, 'Session:', currentSession);
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
                setIsLoading(false); // Ensure isLoading is false after any auth state change
                if (_event === 'SIGNED_OUT') {
                    setError(null); // Clear errors on sign out
                }
            }
        );

        // Cleanup function
        return () => {
            console.log('[AuthContext] useEffect cleanup: Unsubscribing from onAuthStateChange.');
            subscription?.unsubscribe();
        };
    }, []); // Empty dependency array ensures this runs only once on mount and unmount

    const signInWithEmail = async (email: string, password: string) => {
        console.log('[AuthContext] Attempting signInWithEmail for:', email);
        setIsLoading(true);
        setError(null);
        const { error: signInError, data } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
            console.error('[AuthContext] signInWithEmail error:', signInError);
            setError(signInError);
        } else {
            console.log('[AuthContext] signInWithEmail successful. Data:', data);
        }
        setIsLoading(false);
        return { error: signInError, data };
    };

    const signUpWithEmail = async (email: string, password: string) => {
        console.log('[AuthContext] Attempting signUpWithEmail for:', email);
        setIsLoading(true);
        setError(null);
        const { error: signUpError, data } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
            console.error('[AuthContext] signUpWithEmail error:', signUpError);
            setError(signUpError);
        } else {
            console.log('[AuthContext] signUpWithEmail successful. Data:', data);
        }
        setIsLoading(false);
        return { error: signUpError, data };
    };

    const signInWithGitHub = async () => {
        console.log('[AuthContext] Attempting signInWithGitHub.');
        setIsLoading(true);
        setError(null);
        const { error: oauthError, data } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                // Ensure your Supabase project settings have this redirect URL allowed
                redirectTo: `${window.location.origin}${import.meta.env.BASE_URL || '/'}`,
            }
        });
        if (oauthError) {
            console.error('[AuthContext] signInWithGitHub error:', oauthError);
            setError(oauthError);
        } else {
            console.log('[AuthContext] signInWithGitHub initiated. Data:', data);
            // Note: For OAuth, the user is redirected. isLoading will likely remain true
            // until they return and onAuthStateChange fires.
        }
        // setIsLoading(false); // For OAuth, might not set to false immediately here due to redirect
        return { error: oauthError, data };
    };

    const signOut = async () => {
        console.log('[AuthContext] Attempting signOut.');
        setIsLoading(true);
        setError(null);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
            console.error('[AuthContext] signOut error:', signOutError);
            setError(signOutError);
        } else {
            console.log('[AuthContext] signOut successful. Session should now be null via onAuthStateChange.');
            // setSession(null); // No need, onAuthStateChange handles this
            // setUser(null);   // No need, onAuthStateChange handles this
        }
        setIsLoading(false); // Set loading false after signOut attempt
        return { error: signOutError };
    };

    const value: AuthContextType = {
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