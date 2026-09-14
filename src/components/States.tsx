export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return <div className="content-state" role="status">{message}</div>;
}

export function EmptyState({ message = 'No results found.' }: { message?: string }) {
  return <div className="content-state">{message}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="content-state state-error">
      <p role="alert">{message}</p>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}
