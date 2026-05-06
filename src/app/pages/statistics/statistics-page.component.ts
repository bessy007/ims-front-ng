import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { CustomersService } from '../../core/services/customers.service';
import { InventoryService } from '../../core/services/inventory.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { SalesTrendChartComponent } from './sales-trend-chart.component';

const TABS = {
  productsSold: 'products-sold',
  customerReport: 'customer-report',
  wholesaleRetail: 'wholesale-retail',
  product: 'product',
} as const;

function toLocalIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function rangeFromHours(hours: number) {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { dateFrom: toLocalIso(from), dateTo: toLocalIso(to) };
}

function datetimeLocalValue(isoLike: string) {
  return isoLike ? isoLike.slice(0, 16) : '';
}

function fromDatetimeLocal(str: string) {
  if (!str) return null;
  return str.length === 16 ? `${str}:00` : str;
}

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SalesTrendChartComponent],
  templateUrl: './statistics-page.component.html',
  styleUrls: ['./statistics-page.component.css'],
})
export class StatisticsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly statisticsService = inject(StatisticsService);
  private readonly customersService = inject(CustomersService);
  private readonly inventoryService = inject(InventoryService);

  readonly defaultRange = rangeFromHours(24);

  readonly tab = signal<string>(TABS.productsSold);

  readonly draftProducts = signal({ ...this.defaultRange });
  readonly appliedProducts = signal({ ...this.defaultRange });

  readonly rangeCustomer = signal({ ...this.defaultRange });
  readonly draftWholesale = signal({ ...this.defaultRange });
  readonly appliedWholesale = signal({ ...this.defaultRange });

  readonly draftProductStats = signal({ ...this.defaultRange });
  readonly appliedProductStats = signal({ ...this.defaultRange });

  readonly customerMode = signal<'transactions' | 'daily'>('transactions');
  readonly customerSearchControl = this.fb.nonNullable.control('');
  readonly selectedCustomer = signal<any | null>(null);
  readonly customerDropdownOpen = signal(false);
  readonly customerHits = signal<any[]>([]);

  readonly productSearchControl = this.fb.nonNullable.control('');
  readonly selectedProduct = signal<any | null>(null);
  readonly productDropdownOpen = signal(false);
  readonly productList = signal<any[]>([]);

  readonly productsSoldLoading = signal(false);
  readonly productsSoldError = signal(false);
  readonly productsSoldData = signal<any[] | null>(null);

  readonly cashSummaryLoading = signal(false);
  readonly cashSummaryError = signal(false);
  readonly cashSummaryData = signal<any | null>(null);

  readonly cashDailyLoading = signal(false);
  readonly cashDailyError = signal(false);
  readonly cashDailyAllData = signal<any[] | null>(null);

  readonly customerTxLoading = signal(false);
  readonly customerTxError = signal(false);
  readonly customerTxData = signal<any[] | null>(null);

  readonly customerDailyLoading = signal(false);
  readonly customerDailyError = signal(false);
  readonly customerDailyData = signal<any[] | null>(null);

  readonly wholesaleLoading = signal(false);
  readonly wholesaleError = signal(false);
  readonly wholesaleData = signal<any[] | null>(null);

  readonly productStatsLoading = signal(false);
  readonly productStatsError = signal(false);
  readonly productStatsData = signal<any | null>(null);

  readonly trend = computed(() => this.productStatsData()?.salesTrend ?? []);
  readonly productKpis = computed(() => {
    const data = this.productStatsData();
    if (!data) return null;
    const saleQty = (data.saleHistory ?? []).reduce((acc: number, row: any) => acc + Number(row.quantity ?? 0), 0);
    const supplyQty = (data.supplyHistory ?? []).reduce((acc: number, row: any) => acc + Number(row.quantity ?? 0), 0);
    return {
      saleQty,
      supplyQty,
      saleLines: data.saleHistory?.length ?? 0,
      supplyLines: data.supplyHistory?.length ?? 0,
    };
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tabFromUrl = params.get('tab');
      const productIdFromUrl = params.get('productId');

      if (tabFromUrl === 'customer') this.tab.set(TABS.customerReport);
      else if (tabFromUrl === 'product') this.tab.set(TABS.product);
      else if (tabFromUrl === 'wholesale') this.tab.set(TABS.wholesaleRetail);
      else this.tab.set(TABS.productsSold);

      const productId = productIdFromUrl ? Number(productIdFromUrl) : null;
      if (productId && !Number.isNaN(productId)) {
        this.inventoryService.getProduct(productId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (product) => {
            this.selectedProduct.set(product);
            this.productSearchControl.setValue('', { emitEvent: false });
            this.tab.set(TABS.product);
            this.loadProductStatistics();
          },
        });
        return;
      }

      if (this.tab() === TABS.customerReport) this.loadCustomerReport();
      if (this.tab() === TABS.wholesaleRetail) this.loadWholesaleRetail();
    });

    this.customerSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value.trim().length < 1 || !this.customerDropdownOpen()) {
          this.customerHits.set([]);
          return;
        }
        this.customersService.searchCustomers(value, 0, 15).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
          this.customerHits.set(response?.content ?? []);
        });
      });

    this.productSearchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value.trim().length < 1 || !this.productDropdownOpen()) {
          this.productList.set([]);
          return;
        }
        this.inventoryService.searchProductsList({ q: value }, { page: 0, size: 15 }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((response) => {
          this.productList.set(response?.content ?? []);
        });
      });

    this.loadProductsSold();
  }

  setTab(next: string) {
    this.tab.set(next);
    const queryParams: Record<string, string | null> = {};
    if (next === TABS.customerReport) queryParams['tab'] = 'customer';
    else if (next === TABS.wholesaleRetail) queryParams['tab'] = 'wholesale';
    else if (next === TABS.product) queryParams['tab'] = 'product';
    else queryParams['tab'] = null;

    if (next !== TABS.product) {
      queryParams['productId'] = null;
    } else if (this.selectedProduct()?.id != null) {
      queryParams['productId'] = String(this.selectedProduct().id);
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (next === TABS.productsSold) this.loadProductsSold();
    if (next === TABS.customerReport) this.loadCustomerReport();
    if (next === TABS.wholesaleRetail) this.loadWholesaleRetail();
    if (next === TABS.product && this.selectedProduct()) this.loadProductStatistics();
  }

  loadProductsSold() {
    this.productsSoldLoading.set(true);
    this.productsSoldError.set(false);
    this.statisticsService
      .getProductsSold(this.appliedProducts())
      .pipe(
        finalize(() => this.productsSoldLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.productsSoldData.set(data ?? []),
        error: () => this.productsSoldError.set(true),
      });
  }

  loadCustomerReport() {
    this.cashSummaryLoading.set(true);
    this.cashSummaryError.set(false);
    this.statisticsService
      .getCashReportSummary(this.rangeCustomer())
      .pipe(
        finalize(() => this.cashSummaryLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.cashSummaryData.set(data),
        error: () => this.cashSummaryError.set(true),
      });

    if (!this.selectedCustomer() && this.customerMode() === 'daily') {
      this.cashDailyLoading.set(true);
      this.cashDailyError.set(false);
      this.statisticsService
        .getCashReportDailyAll(this.rangeCustomer())
        .pipe(
          finalize(() => this.cashDailyLoading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (data) => this.cashDailyAllData.set(data ?? []),
          error: () => this.cashDailyError.set(true),
        });
    }

    if (this.selectedCustomer() && this.customerMode() === 'transactions') {
      this.customerTxLoading.set(true);
      this.customerTxError.set(false);
      this.statisticsService
        .getCustomerSalesTransactions({
          customerId: this.selectedCustomer().id,
          ...this.rangeCustomer(),
        })
        .pipe(
          finalize(() => this.customerTxLoading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (data) => this.customerTxData.set(data ?? []),
          error: () => this.customerTxError.set(true),
        });
    }

    if (this.selectedCustomer() && this.customerMode() === 'daily') {
      this.customerDailyLoading.set(true);
      this.customerDailyError.set(false);
      this.statisticsService
        .getCustomerSalesDaily({
          customerId: this.selectedCustomer().id,
          ...this.rangeCustomer(),
        })
        .pipe(
          finalize(() => this.customerDailyLoading.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: (data) => this.customerDailyData.set(data ?? []),
          error: () => this.customerDailyError.set(true),
        });
    }
  }

  loadWholesaleRetail() {
    this.wholesaleLoading.set(true);
    this.wholesaleError.set(false);
    this.statisticsService
      .getCustomersWholesaleRetail(this.appliedWholesale())
      .pipe(
        finalize(() => this.wholesaleLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.wholesaleData.set(data ?? []),
        error: () => this.wholesaleError.set(true),
      });
  }

  loadProductStatistics() {
    if (!this.selectedProduct()) return;
    this.productStatsLoading.set(true);
    this.productStatsError.set(false);
    this.statisticsService
      .getProductStatistics({
        productId: this.selectedProduct().id,
        ...this.appliedProductStats(),
      })
      .pipe(
        finalize(() => this.productStatsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (data) => this.productStatsData.set(data),
        error: () => this.productStatsError.set(true),
      });
  }

  applyProductsRange() {
    this.appliedProducts.set({ ...this.draftProducts() });
    this.loadProductsSold();
  }

  applyWholesaleRange() {
    this.appliedWholesale.set({ ...this.draftWholesale() });
    this.loadWholesaleRetail();
  }

  applyProductStatsRange() {
    this.appliedProductStats.set({ ...this.draftProductStats() });
    this.loadProductStatistics();
  }

  setProductsQuickRange(hours: number) {
    const range = rangeFromHours(hours);
    this.draftProducts.set(range);
    this.appliedProducts.set(range);
    this.loadProductsSold();
  }

  setWholesaleQuickRange(hours: number) {
    const range = rangeFromHours(hours);
    this.draftWholesale.set(range);
    this.appliedWholesale.set(range);
    this.loadWholesaleRetail();
  }

  setProductQuickRange(hours: number) {
    const range = rangeFromHours(hours);
    this.draftProductStats.set(range);
    this.appliedProductStats.set(range);
    this.loadProductStatistics();
  }

  setCustomerMode(mode: 'transactions' | 'daily') {
    this.customerMode.set(mode);
    this.loadCustomerReport();
  }

  selectCustomer(customer: any) {
    this.selectedCustomer.set(customer);
    this.customerSearchControl.setValue(customer.name, { emitEvent: false });
    this.customerDropdownOpen.set(false);
    this.loadCustomerReport();
  }

  clearCustomer() {
    this.selectedCustomer.set(null);
    this.customerSearchControl.setValue('', { emitEvent: false });
    this.customerDropdownOpen.set(false);
    this.loadCustomerReport();
  }

  selectProduct(product: any) {
    this.selectedProduct.set(product);
    this.productSearchControl.setValue('', { emitEvent: false });
    this.productDropdownOpen.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'product', productId: String(product.id) },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadProductStatistics();
  }

  clearSelectedProduct() {
    this.selectedProduct.set(null);
    this.productSearchControl.setValue('', { emitEvent: false });
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  printProductsSold() {
    window.print();
  }

  formatDateTime(value: any) {
    if (!value) return '-';
    const x = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(x.getTime())) return String(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  }

  formatDateOnly(value: any) {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}.${m}.${y}`;
    }
    const x = new Date(value);
    if (Number.isNaN(x.getTime())) return String(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`;
  }

  formatMoney(value: any) {
    if (value == null || value === '') return '-';
    return `${Number(value).toFixed(2)} MKD`;
  }

  formatDecimal(value: any) {
    if (value == null || value === '') return '-';
    return Number(value).toFixed(2);
  }

  datetimeLocalValue(value: string) {
    return datetimeLocalValue(value);
  }

  updateDraftProducts(field: 'dateFrom' | 'dateTo', value: string) {
    this.draftProducts.update((range) => ({
      ...range,
      [field]: fromDatetimeLocal(value) ?? range[field],
    }));
  }

  updateDraftWholesale(field: 'dateFrom' | 'dateTo', value: string) {
    this.draftWholesale.update((range) => ({
      ...range,
      [field]: fromDatetimeLocal(value) ?? range[field],
    }));
  }

  updateDraftProductStats(field: 'dateFrom' | 'dateTo', value: string) {
    this.draftProductStats.update((range) => ({
      ...range,
      [field]: fromDatetimeLocal(value) ?? range[field],
    }));
  }

  updateCustomerRange(field: 'dateFrom' | 'dateTo', value: string) {
    this.rangeCustomer.update((range) => ({
      ...range,
      [field]: fromDatetimeLocal(value) ?? range[field],
    }));
    this.loadCustomerReport();
  }
}
