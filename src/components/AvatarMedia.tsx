import clsx from 'clsx';
import { isImageIcon } from '../utils/iconHelpers';

interface AvatarMediaProps {
  icon: string;
  className?: string;
  decorative?: boolean;
  label?: string;
}

const AvatarMedia = ({ icon, className, decorative = true, label = '' }: AvatarMediaProps) => {
  const isImage = isImageIcon(icon);
  const classes = clsx('avatar-media', isImage ? 'avatar-media-image' : 'avatar-media-emoji', className);

  if (isImage) {
    return <img className={classes} src={icon} alt={decorative ? '' : label} loading="lazy" />;
  }

  if (decorative) {
    return (
      <span className={classes} aria-hidden="true">
        {icon}
      </span>
    );
  }

  return (
    <span className={classes} role="img" aria-label={label}>
      {icon}
    </span>
  );
};

export default AvatarMedia;
