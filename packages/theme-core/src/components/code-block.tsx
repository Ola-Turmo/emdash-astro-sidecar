export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}

export default function CodeBlock({ 
  code, 
  language = 'text',
  filename,
  showLineNumbers = false,
}: CodeBlockProps) {
  const lines = code.split('\n');
  
  return (
    <div class="relative group">
      {filename && (
        <div class="absolute top-0 left-0 px-4 py-1 text-xs bg-[var(--color-neutral-800)] text-[var(--color-neutral-300)] rounded-t-lg">
          {filename}
        </div>
      )}
      <pre class={`language-${language} bg-[var(--color-neutral-900)] text-[var(--color-neutral-100)] p-4 rounded-lg overflow-x-auto text-sm ${filename ? 'pt-8' : ''}`}>
        <code class={`language-${language}`}>
          {lines.map((line, i) => (
            <span class={`block ${showLineNumbers ? 'pl-8 relative' : ''}`}>
              {showLineNumbers && (
                <span class="absolute left-0 text-[var(--color-neutral-500)] select-none w-6 text-right pr-4">
                  {i + 1}
                </span>
              )}
              {line}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
