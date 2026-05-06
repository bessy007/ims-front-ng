import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { InventoryService } from '../../core/services/inventory.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-product-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-details-page.component.html',
})
export class ProductDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeTab = signal<'overview' | 'oems' | 'vehicles' | 'crossovers'>('overview');
  readonly loading = signal(true);
  readonly deleting = signal(false);
  readonly product = signal<any | null>(null);
  readonly oemNumbers = computed(() => this.product()?.oemNumbers ?? []);

  constructor() {
    this.loadProduct();
  }

  loadProduct() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.inventoryService
      .getProduct(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) => this.product.set(product),
        error: (error) => {
          console.error(error);
          this.product.set(null);
        },
      });
  }

  deleteProduct() {
    const product = this.product();
    if (!product) return;

    if (!this.alerts.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    this.deleting.set(true);
    this.inventoryService
      .deleteProduct(product.id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.alerts.success('Product deleted successfully');
          void this.router.navigate(['/products']);
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? 'Failed to delete product');
        },
      });
  }

  formatMoneyMkd(value: unknown) {
    return value == null ? '-' : `${Number(value).toFixed(2)} MKD`;
  }

  formatMoneyEur(value: unknown) {
    return value == null ? '-' : `${Number(value).toFixed(2)} EUR`;
  }

  formatDecimal(value: unknown) {
    return value == null ? '-' : Number(value).toFixed(2);
  }
}
