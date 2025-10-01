import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const SignUpPage = () => {
    const navigate = useNavigate();
    const { handleSignUp, error } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError(null);
        if (password.length < 8) {
            setFormError('Password must be at least 8 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setFormError('Passwords do not match.');
            return;
        }
        setIsSubmitting(true);
        try {
            await handleSignUp(email, password);
            navigate('/', { replace: true });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to sign up';
            setFormError(message);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    return (_jsx("div", { className: "auth-shell", children: _jsxs("div", { className: "auth-card", children: [_jsx("h1", { children: "Create an account" }), _jsx("p", { className: "auth-subtitle", children: "Register to start tracking your party's battles." }), (formError || error) && _jsx("p", { className: "auth-error", children: formError ?? error }), _jsxs("form", { className: "auth-form", onSubmit: handleSubmit, children: [_jsx("label", { htmlFor: "email", children: "Email" }), _jsx("input", { id: "email", type: "email", autoComplete: "email", value: email, onChange: (event) => setEmail(event.target.value), required: true }), _jsx("label", { htmlFor: "password", children: "Password" }), _jsx("input", { id: "password", type: "password", autoComplete: "new-password", value: password, onChange: (event) => setPassword(event.target.value), required: true, minLength: 8 }), _jsx("label", { htmlFor: "confirmPassword", children: "Confirm Password" }), _jsx("input", { id: "confirmPassword", type: "password", autoComplete: "new-password", value: confirmPassword, onChange: (event) => setConfirmPassword(event.target.value), required: true, minLength: 8 }), _jsx("button", { type: "submit", className: "primary", disabled: isSubmitting, children: isSubmitting ? 'Creating account…' : 'Sign Up' })] }), _jsxs("p", { className: "auth-footer", children: ["Already have an account? ", _jsx(Link, { to: "/login", children: "Sign in" })] })] }) }));
};
export default SignUpPage;
