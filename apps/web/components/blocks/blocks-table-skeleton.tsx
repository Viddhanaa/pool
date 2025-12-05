import { Card } from '@/components/ui/card';

export function BlocksTableSkeleton() {
  return (
    <Card variant="glass" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-white/5">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Height</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Block Hash</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Found By</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">Reward</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-foreground-subtle">Status</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-foreground-subtle">Found</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-white/5 animate-pulse">
                <td className="py-3 px-4">
                  <div className="h-5 w-16 bg-white/10 rounded"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 w-48 bg-white/10 rounded"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 w-32 bg-white/10 rounded"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 w-24 bg-white/10 rounded ml-auto"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 w-20 bg-white/10 rounded"></div>
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 w-16 bg-white/10 rounded ml-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

