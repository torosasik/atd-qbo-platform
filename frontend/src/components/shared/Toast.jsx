import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, X } from 'lucide-react';

export default function Toast({ message, fix, type = 'success', onDismiss }) {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, fix ? 6000 : 3000); // give longer read time when a fix suggestion is shown
    return () => clearTimeout(timer);
  }, [onDismiss, fix]);

  const styles = {
    success: {
      container: 'bg-green-50 border-green-400 text-green-800',
      icon: <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />,
    },
    error: {
      container: 'bg-red-50 border-red-400 text-red-800',
      icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />,
    },
  };

  const style = styles[type] || styles.success;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
      <div
        className={`flex ${fix ? 'items-start' : 'items-center'} gap-3 rounded-lg border px-4 py-3 shadow-lg min-w-64 max-w-sm ${style.container}`}
      >
        <span className={fix ? 'mt-0.5' : ''}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{message}</p>
          {fix && (
            <p className="text-xs font-normal mt-1 opacity-80 leading-snug">{fix}</p>
          )}
          {type === 'error' && (
            <button
                onClick={() => { onDismiss(); navigate && navigate('/help'); }}
              className="text-xs font-medium mt-1.5 underline opacity-70 hover:opacity-100 transition-opacity"
            >
              Need more help?
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
