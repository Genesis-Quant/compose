import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

export function AppPagination({ onPageChange, page, totalPages }: { onPageChange: (page: number) => void; page: number; totalPages: number }) {
  const safeTotalPages = Math.max(1, totalPages);
  return <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : undefined} onClick={(event) => { event.preventDefault(); onPageChange(Math.max(1, page - 1)); }} /></PaginationItem>{paginationItems(page, safeTotalPages).map((pageNumber) => <PaginationItem key={pageNumber}><PaginationLink href="#" isActive={pageNumber === page} onClick={(event) => { event.preventDefault(); onPageChange(pageNumber); }}>{pageNumber}</PaginationLink></PaginationItem>)}<PaginationItem><PaginationNext href="#" aria-disabled={page >= safeTotalPages} className={page >= safeTotalPages ? "pointer-events-none opacity-50" : undefined} onClick={(event) => { event.preventDefault(); onPageChange(Math.min(safeTotalPages, page + 1)); }} /></PaginationItem></PaginationContent></Pagination>;
}

function paginationItems(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, Math.max(1, totalPages - 4)));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}
