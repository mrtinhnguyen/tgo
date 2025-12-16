import React, { useCallback } from 'react';

export interface ChatTagsProps {
  tags: { display_name: string; color?: string | null }[];
  isActive: boolean;
}

/**
 * Renders up to 4 tags with color styling; shows +N when more exist.
 */
export const ChatTags: React.FC<ChatTagsProps> = React.memo(({ tags, isActive }) => {
  const toHex = useCallback((color?: string | null): string => {
    if (!color) return '#6b7280';
    const c = color.trim().toLowerCase();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
    const map: Record<string, string> = {
      red: '#ef4444', rose: '#f43f5e', pink: '#ec4899', purple: '#a855f7',
      indigo: '#6366f1', blue: '#3b82f6', sky: '#0ea5e9', teal: '#14b8a6',
      green: '#22c55e', lime: '#84cc16', yellow: '#eab308', amber: '#f59e0b',
      orange: '#f97316', gray: '#6b7280', slate: '#64748b'
    };
    return map[c] || '#6b7280';
  }, []);

  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  if (!tags || tags.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {tags.slice(0, 4).map((tag, index) => {
        if (isActive) {
          return (
            <span key={index} className="inline-flex items-center rounded-md px-1 py-0.5 text-[10px] leading-none bg-white/20 text-white">
              {tag.display_name}
            </span>
          );
        }
        const hex = toHex(tag.color ?? undefined);
        const style = { color: hex, backgroundColor: hexToRgba(hex, 0.12) } as React.CSSProperties;
        return (
          <span key={index} className="inline-flex items-center rounded-md px-1 py-0.5 text-[10px] leading-none" style={style}>
            {tag.display_name}
          </span>
        );
      })}
      {tags.length > 4 && (
        <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>+{tags.length - 4}</span>
      )}
    </div>
  );
});

ChatTags.displayName = 'ChatTags';

