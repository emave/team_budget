'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

const components: Components = {
  a: ({ children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

const ALLOWED = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'code',
  'pre',
  'a',
  'blockquote',
  'hr',
  'br',
];

export function Markdown({ source }: { source: string }) {
  return (
    <div className="mini-markdown">
      <ReactMarkdown allowedElements={ALLOWED} unwrapDisallowed components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
