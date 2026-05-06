import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, finalize } from 'rxjs';
import { InventoryService } from '../../core/services/inventory.service';
import { LookupService } from '../../core/services/lookup.service';
import { UiAlertService } from '../../core/services/ui-alert.service';
import { ProductDrawerComponent } from '../../shared/components/product-drawer.component';
import { ProductRowContextMenuComponent } from '../../shared/components/product-row-context-menu.component';
import { TecDocSearchDialogComponent } from '../../shared/components/tecdoc-search-dialog.component';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ProductDrawerComponent,
    ProductRowContextMenuComponent,
    TecDocSearchDialogComponent,
  ],
  templateUrl: './products-page.component.html',
})
export class ProductsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly lookupService = inject(LookupService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly brands = signal<any[]>([]);
  readonly categories = signal<any[]>([]);
  readonly rows = signal<any[]>([]);
  readonly totalPages = signal(0);
  readonly totalElements = signal(0);
  readonly stockFilter = signal<'all' | 'in' | 'out'>('all');
  readonly page = signal(0);
  readonly tecdocDialogOpen = signal(false);
  readonly contextMenu = signal<{ row: any; x: number; y: number } | null>(null);
  readonly drawerMode = signal<'create' | 'edit' | null>(null);
  readonly drawerProductId = signal<number | null>(null);
  readonly drawerPrefillValues = signal<any>(null);

  readonly filtersForm = this.fb.nonNullable.group({
    q: [''],
    articleNumber: [''],
    barcode: [''],
    brandId: [''],
    categoryId: [''],
    active: [''],
  });

  readonly filteredRows = computed(() => {
    const rows = this.rows();
    const stockFilter = this.stockFilter();
    if (stockFilter === 'all') return rows;
    return rows.filter((row) => {
      const quantity = Number(row.quantity ?? 0);
      if (stockFilter === 'in') return row.active && quantity > 0;
      return !row.active || quantity <= 0;
    });
  });

  readonly inStockOnPage = computed(
    () => this.rows().filter((row) => row.active && Number(row.quantity ?? 0) > 0).length,
  );

  constructor() {
    combineLatest([
      this.lookupService.getBrands(),
      this.lookupService.getCategories(),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([brands, categories]: any[]) => {
        this.brands.set(brands?.content ?? brands ?? []);
        this.categories.set(categories?.content ?? categories ?? []);
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const wantNew = params.get('new') === '1';
      const rawEdit = params.get('edit');
      const editIdParsed = rawEdit != null && rawEdit !== '' ? Number.parseInt(rawEdit, 10) : NaN;
      const editId = Number.isFinite(editIdParsed) ? editIdParsed : null;

      this.drawerMode.set(wantNew ? 'create' : editId != null ? 'edit' : null);
      this.drawerProductId.set(editId);
      this.drawerPrefillValues.set(this.buildPrefillValues(params));
    });

    if (this.route.snapshot.routeConfig?.path === 'products/new') {
      this.openNewPart();
    }

    this.loadRows();
  }

  buildPrefillValues(params: any) {
    if (params.get('new') !== '1') return null;

    const tecdocArticleIdRaw = params.get('tecdocArticleId');
    const tecdocSupplierIdRaw = params.get('tecdocSupplierId');
    const brandIdRaw = params.get('brandId');
    const oemsRaw = params.get('oems');

    let oemNumbers: any[] = [];
    try {
      oemNumbers = oemsRaw ? JSON.parse(decodeURIComponent(oemsRaw)) : [];
    } catch {
      oemNumbers = [];
    }

    return {
      name: params.get('name') || '',
      articleNumber: params.get('articleNumber') || '',
      barcode: params.get('barcode') || '',
      tecdocArticleId: tecdocArticleIdRaw ? Number(tecdocArticleIdRaw) : null,
      tecdocSupplierId: tecdocSupplierIdRaw ? Number(tecdocSupplierIdRaw) : null,
      tecdocImageUrl: params.get('tecdocImageUrl') || '',
      brandId: brandIdRaw ? Number(brandIdRaw) : null,
      oemNumbers,
    };
  }

  loadRows() {
    const raw = this.filtersForm.getRawValue();
    this.loading.set(true);
    this.error.set(false);
    this.inventoryService
      .searchProductsList(
        {
          q: raw.q || undefined,
          articleNumber: raw.articleNumber || undefined,
          barcode: raw.barcode || undefined,
          brandId: raw.brandId ? Number(raw.brandId) : undefined,
          categoryId: raw.categoryId ? Number(raw.categoryId) : undefined,
          active: raw.active === '' ? undefined : raw.active === 'true',
        },
        {
          page: this.page(),
          size: 20,
          sort: 'name,asc',
        },
      )
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.rows.set(response?.content ?? []);
          this.totalPages.set(response?.totalPages ?? 0);
          this.totalElements.set(response?.totalElements ?? 0);
        },
        error: (error) => {
          console.error(error);
          this.error.set(true);
          this.rows.set([]);
        },
      });
  }

  setFilterValue(field: keyof typeof this.filtersForm.controls, value: string) {
    this.page.set(0);
    this.filtersForm.controls[field].setValue(value as never);
  }

  resetFilters() {
    this.page.set(0);
    this.stockFilter.set('all');
    this.filtersForm.reset({
      q: '',
      articleNumber: '',
      barcode: '',
      brandId: '',
      categoryId: '',
      active: '',
    });
  }

  stockStatus(row: any) {
    if (!row.active) {
      return { label: 'Inactive', className: 'ims-badge ims-badge--inactive' };
    }
    const quantity = Number(row.quantity ?? 0);
    return quantity > 0
      ? { label: 'In stock', className: 'ims-badge ims-badge--in' }
      : { label: 'Out', className: 'ims-badge ims-badge--out' };
  }

  formatMoney(value: unknown) {
    return value == null ? '-' : Number(value).toFixed(2);
  }

  formatQuantity(value: unknown) {
    return value == null ? '-' : Number(value).toFixed(2);
  }

  openNewPart() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { new: '1' },
      queryParamsHandling: '',
    });
  }

  openEdit(id: number) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: String(id) },
      queryParamsHandling: '',
    });
  }

  closeDrawer() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  openContextMenu(event: MouseEvent, row: any) {
    event.preventDefault();

    const menuWidth = 190;
    const menuHeight = 96;
    const x =
      event.clientX + menuWidth > window.innerWidth
        ? window.innerWidth - menuWidth - 12
        : event.clientX;
    const y =
      event.clientY + menuHeight > window.innerHeight
        ? window.innerHeight - menuHeight - 12
        : event.clientY;

    this.contextMenu.set({ row, x, y });
  }

  closeContextMenu() {
    this.contextMenu.set(null);
  }

  viewProduct(id: number) {
    void this.router.navigate(['/products', id]);
  }

  previousPage() {
    if (this.page() <= 0) return;
    this.page.update((value) => value - 1);
    this.loadRows();
  }

  nextPage() {
    if (this.page() + 1 >= this.totalPages()) return;
    this.page.update((value) => value + 1);
    this.loadRows();
  }

  handleProductSaved() {
    this.loadRows();
  }

  handleTecDocSelect(item: any) {
    const matchedBrand = this.brands().find(
      (brand) =>
        brand.tecdocSupplierId != null &&
        Number(brand.tecdocSupplierId) === Number(item.supplierId),
    );

    this.inventoryService
      .getTecDocArticleDetails({
        articleNo: item.articleNo,
        brandId: matchedBrand?.id,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          this.tecdocDialogOpen.set(false);
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
              new: '1',
              tecdocArticleId: String(details.articleId ?? ''),
              tecdocSupplierId: String(details.supplierId ?? ''),
              articleNumber: details.articleNo ?? '',
              name: details.articleProductName ?? '',
              tecdocImageUrl: details.imageUrl ?? '',
              barcode: details.barcode ?? '',
              brandId: matchedBrand ? String(matchedBrand.id) : '',
              oems: encodeURIComponent(JSON.stringify(details.oemNumbers ?? [])),
            },
          });
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to load TecDoc article details');
        },
      });
  }

  readonly Math = Math;
}
