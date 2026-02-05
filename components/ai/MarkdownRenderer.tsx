
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const parseMarkdown = (text: string) => {
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-white mt-5 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold text-white">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em class="italic text-gray-300">$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre class="bg-black/50 p-3 rounded-md my-2 overflow-x-auto border border-white/10"><code class="font-mono text-sm text-green-300">$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/gim, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-primary font-mono text-xs">$1</code>');

    // Unordered Lists - Add Tailwind classes for styling
    html = html.replace(/^\s*\n\* (.*)/gim, '<ul class="list-disc list-inside ml-2 my-2 space-y-1 text-gray-300">\n* $1');
    html = html.replace(/^(\*\s.*)\s*\n([^*])/gim, '$1\n</ul>\n$2');
    html = html.replace(/^\* (.*)/gim, '<li>$1</li>');
    
    // Ordered Lists - Add Tailwind classes for styling
    html = html.replace(/^\s*\n\d+\. (.*)/gim, '<ol class="list-decimal list-inside ml-2 my-2 space-y-1 text-gray-300">\n1. $1');
    html = html.replace(/^(\d+\.\s.*)\s*\n([^\d.])/gim, '$1\n</ol>\n$2');
    html = html.replace(/^\d+\. (.*)/gim, '<li>$1</li>');

    // Replace newlines with <br> for paragraphs that are not part of other elements
    html = html.replace(/\n/g, '<br />');

    // Clean up extra <br> around block elements to prevent huge gaps
    html = html.replace(/<br \s*\/?>\s*(<(h[1-3]|ul|ol|li|pre|blockquote)>)/gim, '$1');
    html = html.replace(/(<\/(h[1-3]|ul|ol|li|pre|blockquote)>)\s*<br \s*\/?>/gim, '$1');
    html = html.replace(/(<li>.*<\/li>)\s*<br \s*\/?>/gim, '$1');

    return html;
  };

  const safeContent = content || '';
  return <div className="prose-styles text-base leading-relaxed" dangerouslySetInnerHTML={{ __html: parseMarkdown(safeContent) }} />;
};
