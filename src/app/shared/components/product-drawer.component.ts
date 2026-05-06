import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InventoryService } from '../../core/services/inventory.service';
import { UiAlertService } from '../../core/services/ui-alert.service';
import { ProductFormComponent } from './product-form.component';

@Component({
  selector: 'app-product-drawer',
  standalone: true,
  imports: [CommonModule, ProductFormComponent],
  templateUrl: './product-drawer.component.html',
})
export class ProductDrawerComponent implements OnChanges {
  private readonly inventoryService = inject(InventoryService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  @Input() mode: 'create' | 'edit' | null = null;
  @Input() productId: number | null = null;
  @Input() brands: any[] = [];
  @Input() categories: any[] = [];
  @Input() prefillValues: any = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly product = signal<any | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);

  ngOnChanges(changes: SimpleChanges) {
    if (
      (changes['open'] || changes['productId'] || changes['mode']) &&
      this.open &&
      this.mode === 'edit' &&
      this.productId != null
    ) {
      this.loadProduct();
    }

    if (changes['open'] && !this.open) {
      this.product.set(null);
      this.error.set(false);
    }
  }

  get isEdit() {
    return this.mode === 'edit';
  }

  get title() {
    return this.isEdit ? 'Edit product' : 'New product';
  }

  get subtitle() {
    if (this.isEdit) {
      const product = this.product();
      return product
        ? `${product.name || 'Unnamed product'}${
            product.articleNumber ? ` - ${product.articleNumber}` : ''
          }`
        : '';
    }

    return this.prefillValues
      ? `${this.prefillValues.name || 'TecDoc result'}${
          this.prefillValues.articleNumber
            ? ` - ${this.prefillValues.articleNumber}`
            : ''
        }`
      : '';
  }

  get initialValues() {
    return this.mode === 'create' ? this.prefillValues : this.product();
  }

  loadProduct() {
    if (this.productId == null) return;

    this.loading.set(true);
    this.error.set(false);
    this.inventoryService
      .getProduct(this.productId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (product) => this.product.set(product),
        error: (error) => {
          console.error(error);
          this.error.set(true);
        },
      });
  }

  submit(payload: any) {
    this.saving.set(true);
    const request$ =
      this.mode === 'create'
        ? this.inventoryService.createProduct(payload)
        : this.inventoryService.updateProduct(this.productId!, payload);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.alerts.success(
            this.mode === 'create'
              ? 'Product created successfully'
              : 'Product updated successfully',
          );
          this.saved.emit();
          this.closed.emit();
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(
            error?.error?.message ??
              (this.mode === 'create'
                ? 'Failed to create product'
                : 'Failed to update product'),
          );
        },
      });
  }
}
