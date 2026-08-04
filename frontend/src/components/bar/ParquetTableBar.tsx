import { ChevronDown, ChevronRight, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import type { ParquetEnumOption, ParquetFilterValue } from "@/types/table";
import { Button } from "@/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/ui/dropdown-menu";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";

export type ParquetTableBarColumn = {
  canHide: boolean;
  group?: string;
  id: string;
  label: string;
  visible: boolean;
};

export type ParquetTableBarFilter = {
  id: string;
  label: string;
  options?: Record<string, ParquetEnumOption>;
  type: "enum" | "text";
  value: ParquetFilterValue | undefined;
};

type ParquetTableBarProps = {
  columns: ParquetTableBarColumn[];
  filters: ParquetTableBarFilter[];
  onFilter: (id: string, value: ParquetFilterValue | undefined) => void;
  onReset: () => void;
  onToggleColumn: (id: string, visible: boolean) => void;
  onToggleGroup: (group: string, visible: boolean) => void;
};

export default function ParquetTableBar({ columns, filters, onFilter, onReset, onToggleColumn, onToggleGroup }: ParquetTableBarProps) {
  const groupedColumns = groupColumns(columns);
  const namedGroups = [...groupedColumns.keys()].filter((group) => group !== "");

  return <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-3 py-2">
    {filters.map((filter) => filter.type === "enum"
      ? <EnumFilter filter={filter} key={filter.id} onFilter={onFilter} />
      : <TextFilter filter={filter} key={filter.id} onFilter={onFilter} />)}
    {namedGroups.length
? <div className="flex flex-wrap items-center gap-1.5 border-l pl-2">
      {namedGroups.map((group) => {
        const groupItems = groupedColumns.get(group) ?? [];
        const expanded = groupItems.some((column) => column.visible);
        return <Button aria-expanded={expanded} key={group} size="sm" variant="outline" onClick={() => onToggleGroup(group, !expanded)}>{expanded ? <ChevronDown /> : <ChevronRight />}{group}</Button>;
      })}
    </div>
: null}
    <div className="ml-auto flex items-center gap-1.5">
      <ColumnMenu columns={columns} groupedColumns={groupedColumns} onToggleColumn={onToggleColumn} onToggleGroup={onToggleGroup} />
      <Button aria-label="恢复表格默认设置" size="icon-sm" title="恢复默认" variant="ghost" onClick={onReset}><RotateCcw /></Button>
    </div>
  </div>;
}

function TextFilter({ filter, onFilter }: { filter: ParquetTableBarFilter; onFilter: ParquetTableBarProps["onFilter"] }) {
  const [value, setValue] = useState(String(filter.value ?? ""));
  useEffect(() => { setValue(String(filter.value ?? "")); }, [filter.value]);
  useEffect(() => {
    const timeout = window.setTimeout(() => onFilter(filter.id, value.trim() || undefined), 300);
    return () => window.clearTimeout(timeout);
  }, [filter.id, onFilter, value]);
  return <Input aria-label={`筛选${filter.label}`} className="h-8 w-40" placeholder={`筛选${filter.label}`} value={value} onChange={(event) => setValue(event.target.value)} />;
}

function EnumFilter({ filter, onFilter }: { filter: ParquetTableBarFilter; onFilter: ParquetTableBarProps["onFilter"] }) {
  return <Select value={filter.value === undefined ? "__all__" : String(filter.value)} onValueChange={(value) => onFilter(filter.id, value === "__all__" ? undefined : value)}>
    <SelectTrigger aria-label={`筛选${filter.label}`} className="h-8 min-w-36"><SelectValue /></SelectTrigger>
    <SelectContent><SelectItem value="__all__">全部{filter.label}</SelectItem>{Object.entries(filter.options ?? {}).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}

function ColumnMenu({ columns, groupedColumns, onToggleColumn, onToggleGroup }: { columns: ParquetTableBarColumn[]; groupedColumns: Map<string, ParquetTableBarColumn[]>; onToggleColumn: ParquetTableBarProps["onToggleColumn"]; onToggleGroup: ParquetTableBarProps["onToggleGroup"] }) {
  const standalone = groupedColumns.get("") ?? [];
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Columns3 />列</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52">
    <DropdownMenuLabel>显示列</DropdownMenuLabel><DropdownMenuSeparator />
    {standalone.map((column) => <ColumnItem column={column} key={column.id} onToggleColumn={onToggleColumn} />)}
    {[...groupedColumns.entries()].filter(([group]) => group).map(([group, groupItems]) => <DropdownMenuSub key={group}>
      <DropdownMenuSubTrigger>{group}<span className="ml-auto text-xs text-muted-foreground">{groupItems.filter((column) => column.visible).length}/{groupItems.length}</span></DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52"><DropdownMenuCheckboxItem checked={groupItems.every((column) => column.visible)} onCheckedChange={(checked) => onToggleGroup(group, Boolean(checked))}>显示整组</DropdownMenuCheckboxItem><DropdownMenuSeparator />{groupItems.map((column) => <ColumnItem column={column} key={column.id} onToggleColumn={onToggleColumn} />)}</DropdownMenuSubContent>
    </DropdownMenuSub>)}
    {!columns.some((column) => column.canHide) ? <div className="px-2 py-1.5 text-xs text-muted-foreground">固定列不可隐藏</div> : null}
  </DropdownMenuContent></DropdownMenu>;
}

function ColumnItem({ column, onToggleColumn }: { column: ParquetTableBarColumn; onToggleColumn: ParquetTableBarProps["onToggleColumn"] }) {
  return <DropdownMenuCheckboxItem checked={column.visible} disabled={!column.canHide} onCheckedChange={(checked) => onToggleColumn(column.id, Boolean(checked))}>{column.label}</DropdownMenuCheckboxItem>;
}

function groupColumns(columns: ParquetTableBarColumn[]) {
  const groups = new Map<string, ParquetTableBarColumn[]>();
  columns.forEach((column) => {
    const group = column.group ?? "";
    groups.set(group, [...groups.get(group) ?? [], column]);
  });
  return groups;
}
