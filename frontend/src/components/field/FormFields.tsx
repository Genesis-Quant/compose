import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";

type FieldStyleProps = { className?: string; controlClassName?: string; labelClassName?: string };

export function SelectField({ className = "space-y-2", controlClassName = "w-full", disabled = false, label, labelClassName, onChange, options, value }: FieldStyleProps & { disabled?: boolean; label: string; onChange: (value: string) => void; options: { label: string; value: string }[]; value: string }) {
  return <div className={className}><Label className={labelClassName}>{label}</Label><Select disabled={disabled} value={value} onValueChange={onChange}><SelectTrigger className={controlClassName}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

export function TextField({ className = "space-y-2", controlClassName, disabled = false, label, labelClassName, onChange, type = "text", value }: FieldStyleProps & { disabled?: boolean; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <div className={className}><Label className={labelClassName}>{label}</Label><Input className={controlClassName} disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

export function NumberField({ className = "space-y-2", controlClassName, disabled = false, label, labelClassName, max, min, onChange, step = 1, value }: FieldStyleProps & { disabled?: boolean; label: string; max?: number; min: number; onChange: (value: number) => void; step?: number; value: number }) {
  return <div className={className}><Label className={labelClassName}>{label}</Label><Input className={controlClassName} disabled={disabled} max={max} min={min} step={step} type="number" value={value} onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.max(min, max === undefined ? next : Math.min(max, next))); }} /></div>;
}
