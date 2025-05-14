// gemini-repomix-ui/src/components/AuthForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
// Removed: import './AuthForm.css'; // Migrated to Tailwind

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

    // Base classes for reuse
    const inputClasses = "px-3 py-2.5 border border-[#dadce0] rounded-[4px] text-base w-full focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20";
    const buttonBaseClasses = "px-[18px] py-2.5 border-none rounded-[4px] cursor-pointer font-medium text-base transition-colors duration-200 ease-in-out disabled:bg-[#ccc] disabled:cursor-not-allowed disabled:opacity-70";
    const primaryButtonClasses = "bg-[#1a73e8] text-white hover:enabled:bg-[#185abc]";
    const secondaryButtonClasses = "bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] hover:enabled:bg-[#dadce0]";
    const oauthButtonClasses = "w-full bg-[#24292e] text-white mt-5 hover:enabled:bg-black";

    return (
        // .auth-container
        <div className="max-w-[400px] mx-auto my-[50px] p-[30px] border border-[#dadce0] rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),_0_1px_2px_rgba(0,0,0,0.24)] font-sans">
            {/* .auth-container h2 */}
            <h2 className="mt-0 mb-5 text-[#333] font-medium text-center text-xl">
                {isLogin ? 'Login' : 'Sign Up'}
            </h2>
            {/* .auth-form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-[15px]">
                {/* .auth-form-group */}
                <div className="flex flex-col gap-[6px]">
                    {/* .auth-form-group label */}
                    <label htmlFor="email" className="text-[0.9em] text-[#5f6368] font-medium">
                        Email:
                    </label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                        className={inputClasses}
                    />
                </div>
                {/* .auth-form-group */}
                <div className="flex flex-col gap-[6px]">
                    {/* .auth-form-group label */}
                    <label htmlFor="password" className="text-[0.9em] text-[#5f6368] font-medium">
                        Password:
                    </label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                        className={inputClasses}
                    />
                </div>
                {/* .auth-error */}
                {error && <p className="text-[#c5221f] text-[0.9em] mt-[5px] text-center">{error.message}</p>}
                {/* .auth-button-group */}
                <div className="flex gap-[10px] justify-center mt-[10px]">
                    <button
                        type="submit"
                        disabled={isLoading || !email || !password}
                        className={`${buttonBaseClasses} ${primaryButtonClasses}`}
                    >
                        {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLogin(!isLogin)}
                        disabled={isLoading}
                        className={`${buttonBaseClasses} ${secondaryButtonClasses}`}
                    >
                        Switch to {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </div>
            </form>
            {/* .auth-separator */}
            <hr className="my-[30px] border-none border-t border-[#eee]" />
            <button
                onClick={signInWithGitHub}
                disabled={isLoading}
                className={`${buttonBaseClasses} ${oauthButtonClasses}`}
            >
                {isLoading ? 'Processing...' : 'Sign in with GitHub'}
            </button>
            {/* Add other OAuth providers similarly */}
        </div>
    );
};

export default AuthForm;