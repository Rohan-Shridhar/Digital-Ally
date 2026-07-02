# Lazy Image Loading

This document describes how Digital Ally lazy-loads images to reduce unnecessary network requests and improve page performance.

## Overview

Images are loaded only when they are about to enter the viewport. The implementation uses:

- [`react-lazy-load-image-component`](https://www.npmjs.com/package/react-lazy-load-image-component) (Intersection Observer under the hood) for React UI images
- Native `loading="lazy"` and `decoding="async"` for generated HTML previews
- Placeholder and fallback SVG assets in `public/images/`

## React usage

```tsx
import { LazyImage } from '@/components/LazyImage';

<LazyImage
  src="https://example.com/photo.jpg"
  alt="Business storefront"
  className="w-full h-48 object-cover rounded-lg"
  fallbackSrc="/images/fallback.svg"
  placeholderSrc="/images/placeholder.svg"
/>
```

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `src` | — | Image URL to load when visible |
| `alt` | — | Accessible alt text (required) |
| `fallbackSrc` | `/images/fallback.svg` | Shown if the primary image fails to load |
| `placeholderSrc` | `/images/placeholder.svg` | Low-quality placeholder while loading |
| `effect` | `blur` | Placeholder transition (`blur`, `opacity`, `black-and-white`) |

## Generated HTML previews

When website HTML is sanitized for the live preview iframe, `enhanceHtmlImages()` automatically:

1. Adds `loading="lazy"` and `decoding="async"` to `<img>` tags
2. Applies the `da-lazy-image` CSS class for skeleton styling
3. Sets `data-fallback="/images/fallback.svg"` for documentation and future enhancements

## Testing

```bash
npm test
```

Tests cover HTML enhancement, sanitize integration, and the `LazyImage` fallback behavior.
