export default function Loading() {
  return <div className="mx-auto min-h-[60vh] max-w-7xl animate-pulse px-4 py-16"><div className="h-10 w-64 bg-muted" /><div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] bg-muted" />)}</div></div>;
}
