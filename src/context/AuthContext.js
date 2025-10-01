import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchSession, signIn, signOut, signUp } from '../data/auth';
const AuthContext = createContext(undefined);
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBootstrapping, setIsBootstrapping] = useState(true);
    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            try {
                const session = await fetchSession();
                if (!cancelled) {
                    setUser(session);
                }
            }
            catch (err) {
                if (!cancelled) {
                    console.warn('Failed to load user session', err);
                    setUser(null);
                }
            }
            finally {
                if (!cancelled) {
                    setIsBootstrapping(false);
                }
            }
        };
        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, []);
    const handleAuth = useCallback(async (fn) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fn();
            setUser(result);
        }
        catch (err) {
            console.error('Authentication error', err);
            setError(err instanceof Error ? err.message : 'Authentication failed');
            setUser(null);
            throw err;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const handleSignIn = useCallback(async (email, password) => {
        await handleAuth(() => signIn({ email, password }));
    }, [handleAuth]);
    const handleSignUp = useCallback(async (email, password) => {
        await handleAuth(() => signUp({ email, password }));
    }, [handleAuth]);
    const handleSignOut = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signOut();
            setUser(null);
        }
        catch (err) {
            console.error('Sign out failed', err);
            setError(err instanceof Error ? err.message : 'Sign out failed');
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    const value = useMemo(() => ({ user, isLoading, isBootstrapping, error, handleSignIn, handleSignUp, handleSignOut }), [error, handleSignIn, handleSignOut, handleSignUp, isBootstrapping, isLoading, user]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
};
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
