import React from 'react';

const ChartWrapper = ({ title, children, isLoading, isError }) => (
    <div className="flex h-full min-h-[420px] w-full min-w-0 flex-col rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)]">
        <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>
            <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500/80" aria-hidden="true" />
        </div>
        <div className="flex min-h-0 flex-1 w-full items-center justify-center">
            {isLoading ? <p className="text-sm text-slate-400">Loading...</p> : isError ? <p className="text-sm text-rose-500">Failed to fetch data</p> : children || <p className="text-sm text-slate-400">No Data Available</p>}
        </div>
    </div>
);

export default ChartWrapper;