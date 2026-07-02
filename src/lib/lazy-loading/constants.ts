/** Default paths for lazy-loaded image assets served from /public. */
export const LAZY_IMAGE_FALLBACK = '/images/fallback.svg';
export const LAZY_IMAGE_PLACEHOLDER = '/images/placeholder.svg';

/** CSS class applied to lazily enhanced images in generated HTML previews. */
export const LAZY_IMAGE_CLASS = 'da-lazy-image';

export const LAZY_IMAGE_STYLES = `<style>
  img.${LAZY_IMAGE_CLASS} {
    background-color: #e5e7eb;
    object-fit: cover;
    min-height: 3rem;
    transition: opacity 0.3s ease;
  }
</style>`;
