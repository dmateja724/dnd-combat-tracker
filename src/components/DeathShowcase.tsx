import type { MouseEventHandler, ReactNode } from 'react';

interface DeathShowcaseProps {
  card: ReactNode;
  message: string;
  onDismiss: () => void;
}

const DeathShowcase = ({ card, message, onDismiss }: DeathShowcaseProps) => {
  const handleContentClick: MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <div className="death-showcase-overlay" role="presentation" onClick={onDismiss}>
      <div className="death-showcase-backdrop" />
      <div className="death-showcase-content" onClick={handleContentClick}>
        <div className="death-showcase-card">{card}</div>
        <p className="death-showcase-message" aria-live="polite">
          {message}
        </p>
      </div>
    </div>
  );
};

export default DeathShowcase;

