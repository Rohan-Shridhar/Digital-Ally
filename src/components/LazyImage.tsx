import React, { useState, useCallback } from 'react';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { LAZY_IMAGE_FALLBACK, LAZY_IMAGE_PLACEHOLDER } from '@/lib/lazy-loading';
import 'react-lazy-load-image-component/src/effects/blur.css';

export interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  width?: number | string;
  height?: number | string;
  fallbackSrc?: string;
  placeholderSrc?: string;
  effect?: 'blur' | 'opacity' | 'black-and-white';
}

/**
 * Lazy-loads images when they enter the viewport (Intersection Observer via
 * react-lazy-load-image-component), shows a placeholder while loading, and
 * falls back to a default image on error.
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  width,
  height,
  fallbackSrc = LAZY_IMAGE_FALLBACK,
  placeholderSrc = LAZY_IMAGE_PLACEHOLDER,
  effect = 'blur',
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    if (!hasError && currentSrc !== fallbackSrc) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
  }, [currentSrc, fallbackSrc, hasError]);

  return (
    <LazyLoadImage
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      effect={effect}
      placeholderSrc={placeholderSrc}
      className={className}
      wrapperClassName={`da-lazy-image-wrapper ${wrapperClassName}`.trim()}
      onError={handleError}
      loading="lazy"
      decoding="async"
    />
  );
};
