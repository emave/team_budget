'use client';

import { useState, type ReactNode } from 'react';
import { Server, Client } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import { useServerInsertedHTML } from 'next/navigation';

export function StyletronRegistry({ children }: { children: ReactNode }) {
  const [engine] = useState<Server | Client>(() => {
    if (typeof document === 'undefined') return new Server();
    return new Client();
  });

  useServerInsertedHTML(() => {
    if (!(engine instanceof Server)) return null;
    const sheets = engine.getStylesheets() as { css: string; attrs: Record<string, string> }[];
    return (
      <>
        {sheets.map((sheet, i) => (
          <style
            key={i}
            data-styletron=""
            media={sheet.attrs.media}
            dangerouslySetInnerHTML={{ __html: sheet.css }}
          />
        ))}
      </>
    );
  });

  return <StyletronProvider value={engine}>{children}</StyletronProvider>;
}
