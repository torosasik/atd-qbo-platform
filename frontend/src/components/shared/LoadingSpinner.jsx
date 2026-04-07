export default function LoadingSpinner({ size = 'md', color = 'atd-blue' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-4',
  };

  const colorClasses = {
    'atd-blue': 'border-atd-blue',
    white: 'border-white',
    gray: 'border-gray-400',
  };

  return (
    <div
      className={`animate-spin rounded-full border-t-transparent ${sizeClasses[size]} ${colorClasses[color]}`}
      role="status"
      aria-label="Loading"
    />
  );
}
