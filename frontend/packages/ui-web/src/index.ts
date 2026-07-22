// @sethu/ui-web — the global shadcn-style component library. Every component: CVA variants,
// token-backed Tailwind utilities only (tokens.css), lucide icons, WCAG 2.2 AA. Add a component =
// component + story + test + this barrel, same change.
export { cn } from "./lib/cn";

// Actions & identity
export { Button, buttonVariants, type ButtonProps } from "./components/Button";
export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarLabel,
  avatarVariants,
  avatarFallbackVariants,
  type AvatarProps,
  type AvatarFallbackProps,
  type AvatarLabelProps,
} from "./components/Avatar";

// Surfaces
export {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  cardVariants,
  type CardProps,
  type CardHeaderProps,
} from "./components/Card";
export { EmptyState, type EmptyStateProps } from "./components/EmptyState";
export {
  Skeleton,
  SkeletonText,
  type SkeletonProps,
  type SkeletonTextProps,
} from "./components/Skeleton";

// Status & metrics
export { StatusPill, statusPillVariants, type StatusPillProps } from "./components/StatusPill";
export { IconChip, iconChipVariants, type IconChipProps } from "./components/IconChip";
export { KpiTile, kpiTileVariants, type KpiTileProps } from "./components/KpiTile";

// Forms & filters
export { Label, labelVariants, type LabelProps } from "./components/Label";
export { Input, inputVariants, type InputProps } from "./components/Input";
export { Textarea, textareaVariants, type TextareaProps } from "./components/Textarea";
export { SearchInput, type SearchInputProps } from "./components/SearchInput";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  selectTriggerVariants,
  type SelectTriggerProps,
} from "./components/Select";
export {
  FilterField,
  FilterBand,
  type FilterFieldProps,
  type FilterBandProps,
} from "./components/FilterField";

// Navigation
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  type BreadcrumbProps,
  type BreadcrumbLinkProps,
} from "./components/Breadcrumb";
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
  type TabsListProps,
  type TabsTriggerProps,
} from "./components/Tabs";
export { Pagination, type PaginationProps, type PaginationLabels } from "./components/Pagination";

// Data
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableActionLink,
  tableVariants,
  tableHeaderVariants,
  type TableProps,
  type TableHeaderProps,
  type TableActionLinkProps,
} from "./components/Table";

// Overlays & feedback
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  type DialogContentProps,
} from "./components/Dialog";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  sheetContentVariants,
  type SheetContentProps,
} from "./components/Sheet";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  dropdownMenuItemVariants,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
} from "./components/DropdownMenu";
export {
  ToastProvider,
  ToastViewport,
  useToast,
  toastVariants,
  type ToastTone,
  type ToastOptions,
  type ToastViewportProps,
} from "./components/Toast";

// Sidebar (global app frame)
export {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  useSidebar,
  type SidebarProps,
  type SidebarProviderProps,
} from "./components/Sidebar";
export {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  sidebarMenuButtonVariants,
  type SidebarMenuButtonProps,
} from "./components/SidebarMenu";

// Filters, search-selects & page structure
export { Combobox, type ComboboxProps, type ComboboxOption } from "./components/Combobox";
export {
  TableColumnFilter,
  type TableColumnFilterProps,
  type TableColumnFilterOption,
} from "./components/TableColumnFilter";
export {
  PageShell,
  PageHeader,
  type PageShellProps,
  type PageHeaderProps,
} from "./components/PageHeader";

// Data table (generic, sortable, column-configurable)
export {
  DataTable,
  type DataTableProps,
  type DataTableColumn,
  type DataTableSort,
  type SortDirection,
} from "./components/DataTable";
export {
  DataTableViewOptions,
  type DataTableViewOptionsProps,
} from "./components/DataTableViewOptions";
export { ProgressBar, progressFillVariants, type ProgressBarProps } from "./components/ProgressBar";
