import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import './AuthForm.css'; // <-- Import the new CSS file

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
        // Apply container class
        <div className="auth-container">
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            {/* Apply form class */}
            <form onSubmit={handleSubmit} className="auth-form">
                {/* Apply form group classes */}
                <div className="auth-form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading} // Disable inputs while loading
                    />
                </div>
                {/* Apply form group classes */}
                <div className="auth-form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading} // Disable inputs while loading
                    />
                </div>
                {error && <p className="auth-error">{error.message}</p>}
                {/* Apply button group and button classes */}
                <div className="auth-button-group">
                    <button
                        type="submit"
                        disabled={isLoading || !email || !password} // Disable if inputs are empty or loading
                        className="auth-button auth-button-primary"
                    >
                        {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        disabled={isLoading} // Disable switching mode while loading
                        className="auth-button auth-button-secondary"
                    >
                        Switch to {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </div>
            </form>
            {/* Apply separator style */}
            <hr className="auth-separator" />
            {/* Apply OAuth button style */}
            <button
                onClick={signInWithGitHub}
                disabled={isLoading} // Disable while loading
                className="auth-button auth-button-oauth"
            >
                {isLoading ? 'Processing...' : 'Sign in with GitHub'}
            </button>
            {/* Add other OAuth providers similarly */}
        </div>
    );
};

export default AuthForm;