import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
const Modal = ({ isOpen, onClose, children, ariaLabel, ariaLabelledBy }) => {
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined')
            return;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined')
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);
    if (!isOpen || typeof document === 'undefined') {
        return null;
    }
    return createPortal(_jsx("div", { className: "modal-backdrop", onClick: (event) => event.target === event.currentTarget && onClose(), role: "presentation", children: _jsx("div", { className: "modal-container", role: "dialog", "aria-modal": "true", "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, children: children }) }), document.body);
};
export default Modal;
