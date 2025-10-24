export const isImageIcon = (icon: string | null | undefined): boolean => {
  if (typeof icon !== 'string') {
    return false;
  }
  const trimmed = icon.trim();
  if (!trimmed) {
    return false;
  }
  return /^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
};

