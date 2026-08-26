import Icon from '../Icon';

const toneClasses = {
    primary: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
};

export default function SectionTitle({ title, icon, tone = 'primary', eyebrow }) {
    return (
        <div className="flex items-center gap-3">
            <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ' + (toneClasses[tone] || toneClasses.primary)}>
                <Icon name={icon} size={20} />
            </div>
            <div className="min-w-0">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
                {eyebrow && <p className="mt-0.5 text-sm text-slate-500">{eyebrow}</p>}
            </div>
        </div>
    );
}
