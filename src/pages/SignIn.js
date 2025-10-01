import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const SignInPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { handleSignIn, error } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const destination = location.state?.from?.pathname ?? '/';
    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError(null);
        setIsSubmitting(true);
        try {
            await handleSignIn(email, password);
            navigate(destination, { replace: true });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to sign in';
            setFormError(message);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx("div", { className: "auth-shell", children: _jsxs("div", { className: "auth-card", children: [_jsx("h1", { children: "Welcome back" }), _jsx("p", { className: "auth-subtitle", children: "Sign in to resume your ongoing encounters." }), (formError || error) && _jsx("p", { className: "auth-error", children: formError ?? error }), _jsxs("form", { className: "auth-form", onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (event) => setEmail(event.target.value), required: true }), _jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "current-password", value: password, onChange: (event) => setPassword(event.target.value), required: true, minLength: 8 }), _jsx("button", { type: "submit", className: "primary", disabled: isSubmitting, children: isSubmitting ? 'Signing in…' : 'Sign In' })] }), _jsxs("p", { className: "auth-footer", children: ["Need an account? ", _jsx(Link, { to: "/signup", children: "Create one" })] })] }) }));
};
export default SignInPage;
