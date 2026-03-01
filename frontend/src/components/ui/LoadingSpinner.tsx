export function LoadingSpinner({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 max-w-md text-center">
        <p className="text-sm font-medium text-red-700">Erreur de chargement</p>
        <p className="text-xs text-red-500 mt-1">{message}</p>
      </div>
    </div>
  );
}
