import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { InventoryService } from '../../core/services/inventory.service';
import { LookupService } from '../../core/services/lookup.service';
import { TransferService } from '../../core/services/transfer.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-transfers-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './transfers-page.component.html',
})
export class TransfersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly lookupService = inject(LookupService);
  private readonly inventoryService = inject(InventoryService);
  private readonly transferService = inject(TransferService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly warehouses = signal<any[]>([]);
  readonly products = signal<any[]>([]);
  readonly transfer = signal<any | null>(null);
  readonly transferId = signal<number | null>(null);
  readonly loadingWarehouses = signal(true);
  readonly searchingProducts = signal(false);
  readonly busy = signal(false);

  readonly form = this.fb.nonNullable.group({
    sourceWarehouseId: [0, Validators.min(1)],
    destinationWarehouseId: [0, Validators.min(1)],
    search: [''],
  });

  readonly canSearch = computed(
    () => Number(this.form.controls.sourceWarehouseId.getRawValue()) > 0,
  );

  constructor() {
    this.loadWarehouses();

    this.form.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchProducts(value));
  }

  loadWarehouses() {
    this.loadingWarehouses.set(true);
    this.lookupService
      .getWarehouses()
      .pipe(
        finalize(() => this.loadingWarehouses.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response: any) => {
        this.warehouses.set(response?.content ?? response ?? []);
      });
  }

  searchProducts(query: string) {
    const sourceWarehouseId = Number(this.form.controls.sourceWarehouseId.getRawValue());
    if (!query || !sourceWarehouseId) {
      this.products.set([]);
      return;
    }

    this.searchingProducts.set(true);
    this.inventoryService
      .posSearchProducts({ q: query, warehouseId: sourceWarehouseId })
      .pipe(
        finalize(() => this.searchingProducts.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.products.set(response?.content ?? []);
      });
  }

  ensureTransfer(onReady: (transferId: number) => void) {
    if (this.transferId()) {
      onReady(this.transferId()!);
      return;
    }

    const sourceWarehouseId = Number(this.form.controls.sourceWarehouseId.getRawValue());
    const destinationWarehouseId = Number(this.form.controls.destinationWarehouseId.getRawValue());

    if (!sourceWarehouseId || !destinationWarehouseId) {
      this.alerts.error('Select source and destination warehouses first');
      return;
    }

    this.busy.set(true);
    this.transferService
      .createTransfer({
        sourceWarehouseId,
        destinationWarehouseId,
        status: 'DRAFT',
      })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.transferId.set(Number(response.id));
          this.transfer.set(response);
          onReady(Number(response.id));
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to create transfer');
        },
      });
  }

  addProduct(product: any) {
    this.ensureTransfer((transferId) => {
      this.busy.set(true);
      this.transferService
        .addTransferItem(transferId, {
          productId: product.id,
          quantity: 1,
        })
        .pipe(
          finalize(() => this.busy.set(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe({
          next: () => this.loadTransfer(transferId),
          error: (error) => {
            console.error(error);
            this.alerts.error('Failed to add transfer item');
          },
        });
    });
  }

  loadTransfer(transferId: number) {
    this.transferService
      .getTransfer(transferId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.transfer.set(response);
      });
  }

  confirmTransfer() {
    if (!this.transferId()) return;

    this.busy.set(true);
    this.transferService
      .confirmTransfer(this.transferId()!)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.alerts.success('Transfer completed!');
          this.loadTransfer(this.transferId()!);
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to confirm transfer');
        },
      });
  }
}
