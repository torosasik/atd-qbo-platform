/**
 * Accessible toggle switch component.
 * Uses a checkbox input for proper semantics and keyboard accessibility.
 */
export default function Toggle({ checked, onChange, disabled = false, label, id, ariaLabel }) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel || label}
        />
        <div
          className={`w-11 h-6 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-atd-blue peer-focus-visible:ring-offset-2 ${
            checked ? 'bg-atd-blue' : 'bg-gray-300'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      {label && (
        <span className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label}
        </span>
      )}
    </label>
  );
}
