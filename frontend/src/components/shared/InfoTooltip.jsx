import { HelpCircle } from 'lucide-react';

/**
 * InfoTooltip
 * Shows a HelpCircle icon. Hovering reveals a styled tooltip above the icon.
 *
 * Props:
 *   text  {string}  The tooltip content to display.
 */
export default function InfoTooltip({ text }) {
  return (
    <span className="relative inline-flex items-center group ml-1.5 align-middle">
      <HelpCircle className="h-3.5 w-3.5 text-gray-400 group-hover:text-atd-blue cursor-help transition-colors" />
      {/* Tooltip bubble */}
      <span
        className={[
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
          'max-w-xs w-auto bg-gray-900 text-white text-xs leading-relaxed',
          'rounded-lg px-3 py-2 shadow-xl',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
          'transition-all duration-150 z-50 pointer-events-none',
        ].join(' ')}
      >
        {text}
        {/* Arrow pointing down */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
