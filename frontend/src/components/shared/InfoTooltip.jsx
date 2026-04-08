import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * InfoTooltip - Accessible tooltip component
 * Shows a HelpCircle icon. Focus/hover reveals a styled tooltip above the icon.
 * Supports both mouse and keyboard (focus) interactions.
 *
 * @param {string} text - The tooltip content to display
 */
export default function InfoTooltip({ text }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span 
      className="relative inline-flex items-center group ml-1.5 align-middle"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <button
        type="button"
        className="inline-flex items-center justify-center h-4 w-4 text-gray-400 hover:text-atd-blue cursor-help transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-atd-blue focus-visible:ring-offset-1 rounded"
        aria-describedby="tooltip-description"
        tabIndex={0}
      >
        <span className="sr-only">More information</span>
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      
      {/* Tooltip bubble - uses role="tooltip" for screen readers */}
      <span
        id="tooltip-description"
        role="tooltip"
        className={[
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
          'max-w-xs w-auto bg-gray-900 text-white text-xs leading-relaxed',
          'rounded-lg px-3 py-2 shadow-xl',
          'opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible group-hover:opacity-100 group-hover:visible',
          'transition-all duration-150 z-50 pointer-events-none',
        ].join(' ')}
        aria-hidden={!isVisible}
      >
        {text}
        {/* Arrow pointing down */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
}
