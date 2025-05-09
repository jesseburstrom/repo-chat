// gemini-repomix-ui/src/AuthForm.tsx
import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';

const AuthForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const { signInWithEmail, signUpWithEmail, signInWithGitHub, error, isLoading } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            await signInWithEmail(email, password);
        } else {
            await signUpWithEmail(email, password);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                </div>
                <div>
                    <label htmlFor="password">Password:</label>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                </div>
                {error && <p style={{ color: 'red' }}>{error.message}</p>}
                <button type="submit" disabled={isLoading} style={{ padding: '10px 15px', marginRight: '10px' }}>
                    {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                </button>
                <button type="button" onClick={() => setIsLogin(!isLogin)} style={{ padding: '10px 15px' }}>
                    Switch to {isLogin ? 'Sign Up' : 'Login'}
                </button>
            </form>
            <hr style={{ margin: '20px 0' }} />
            <button onClick={signInWithGitHub} disabled={isLoading} style={{ padding: '10px 15px', display: 'block', width: '100%', backgroundColor: '#333', color: 'white' }}>
                {isLoading ? 'Processing...' : 'Sign in with GitHub'}
            </button>
            {/* Add other OAuth providers similarly */}
        </div>
    );
};

export default AuthForm;