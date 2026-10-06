import { useEffect } from 'react';

/**
 * Lightweight, dependency-free hook for route-specific SEO management.
 * Updates document title, meta description, Open Graph, Twitter cards,
 * canonical link, and robots indexation directive.
 */
export function useSEO({
  title,
  description,
  canonical,
  noindex = false,
}) {
  useEffect(() => {
    // 1. Title
    if (title) {
      document.title = title;
    }

    // Helper to update or create a meta tag
    const setMeta = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 2. Meta description
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }

    // 3. Open Graph & Twitter titles
    if (title) {
      setMeta('property', 'og:title', title);
      setMeta('name', 'twitter:title', title);
    }

    // 4. Robots indexing directive
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // 5. Canonical URL
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.setAttribute('rel', 'canonical');
      document.head.appendChild(linkCanonical);
    }
    const currentCanonical = canonical || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
    if (currentCanonical) {
      linkCanonical.setAttribute('href', currentCanonical);
    }
  }, [title, description, canonical, noindex]);
}

export default useSEO;
