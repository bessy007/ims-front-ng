import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom } from 'rxjs';
import { CustomersService } from '../../core/services/customers.service';
import { InventoryService } from '../../core/services/inventory.service';
import { SalesService } from '../../core/services/sales.service';
import { UiAlertService } from '../../core/services/ui-alert.service';
import { SalesPaymentDialogComponent } from '../../shared/components/sales-payment-dialog.component';
import { formatDateTime, formatMoney, round2, toDateTimeLocalValue } from '../../shared/utils/formatters';

function calculateItem(item: any) {
  const quantity = Number(item.quantity ?? 0);
  const unitPriceMkd = Number(item.unitPriceMkd ?? 0);
  const discountPercent = Number(item.discountPercent ?? 0);
  const discountAmountMkd = round2(unitPriceMkd * (discountPercent / 100));
  const finalUnitPriceMkd = round2(unitPriceMkd - discountAmountMkd);
  const lineTotalMkd = round2(finalUnitPriceMkd * quantity);

  return {
    ...item,
    quantity,
    unitPriceMkd,
    discountPercent,
    discountAmountMkd,
    finalUnitPriceMkd,
    lineTotalMkd,
  };
}

function calculateTotals(items: any[]) {
  const subtotal = round2(items.reduce((sum, item) => sum + Number(item.unitPriceMkd ?? 0) * Number(item.quantity ?? 0), 0));
  const discountAmount = round2(items.reduce((sum, item) => sum + Number(item.discountAmountMkd ?? 0) * Number(item.quantity ?? 0), 0));
  return { subtotal, discountAmount, vatAmount: 0, totalAmount: round2(subtotal - discountAmount) };
}

@Component({
  selector: 'app-sales-document-details-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SalesPaymentDialogComponent],
  templateUrl: './sales-document-details-page.component.html',
})
export class SalesDocumentDetailsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly inventoryService = inject(InventoryService);
  private readonly salesService = inject(SalesService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly saving = signal(false);
  readonly paymentDialogOpen = signal(false);
  readonly paymentPaidTotal = signal('0');
  readonly paymentSaving = signal(false);
  readonly redirectAfterPayment = signal(false);
  readonly isEditMode = signal(false);
  readonly productSearchLoading = signal(false);
  readonly productSearchError = signal(false);
  readonly document = signal<any | null>(null);
  readonly customers = signal<any[]>([]);
  readonly editItems = signal<any[]>([]);
  readonly searchResults = signal<any[]>([]);

  readonly editHeaderForm = this.fb.nonNullable.group({
    documentType: ['RETAIL'],
    documentDate: [''],
    customerId: [''],
    paymentMethod: ['CASH'],
    description: [''],
    warehouseId: [''],
    productSearch: [''],
  });

  constructor() {
    this.loadDocument();
    this.loadCustomers();
  }

  loadDocument() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }

    this.loading.set(true);
    this.salesService
      .getSalesDocument(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.document.set(response);
          this.error.set(false);
        },
        error: (error) => {
          console.error(error);
          this.document.set(null);
          this.error.set(true);
        },
      });
  }

  loadCustomers() {
    this.customersService
      .searchCustomers('', 0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => {
        this.customers.set(response?.content ?? response ?? []);
      });
  }

  enterEditMode() {
    const data = this.document();
    if (!data) return;

    this.editHeaderForm.reset({
      documentType: data.documentType ?? 'RETAIL',
      documentDate: data.documentDate ?? '',
      customerId: data.customerId != null ? String(data.customerId) : '',
      paymentMethod: data.paymentMethod ?? 'CASH',
      description: data.description ?? '',
      warehouseId: data.warehouseId != null ? String(data.warehouseId) : '',
      productSearch: '',
    });

    this.editItems.set((data.items ?? []).map((item: any) => calculateItem({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity ?? 0),
      unitPriceMkd: Number(item.unitPriceMkd ?? 0),
      discountPercent: Number(item.discountPercent ?? 0),
      stockQuantity: Number(item.stockQuantity ?? 0),
    })));

    this.isEditMode.set(true);
  }

  cancelEdit() {
    this.isEditMode.set(false);
    this.editItems.set([]);
    this.searchResults.set([]);
    this.editHeaderForm.controls.productSearch.setValue('');
  }

  searchProducts(value: string) {
    const warehouseId = Number(this.editHeaderForm.controls.warehouseId.getRawValue() || 0);
    if (!this.isEditMode() || !value.trim() || !warehouseId) {
      this.searchResults.set([]);
      return;
    }

    this.productSearchLoading.set(true);
    this.productSearchError.set(false);
    this.inventoryService
      .posSearchProducts({ q: value, warehouseId, page: 0, size: 20 })
      .pipe(
        finalize(() => this.productSearchLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.searchResults.set(response?.content ?? []),
        error: (error) => {
          console.error(error);
          this.productSearchError.set(true);
        },
      });
  }

  addToCart(product: any) {
    this.editItems.update((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id
            ? calculateItem({
                ...item,
                quantity: round2(Number(item.quantity) + 1),
                stockQuantity: Number(product.stockQuantity ?? item.stockQuantity ?? 0),
              })
            : item,
        );
      }

      return [
        ...items,
        calculateItem({
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPriceMkd: Number(product.retailPriceMkd ?? 0),
          discountPercent: 0,
          stockQuantity: Number(product.stockQuantity ?? 0),
        }),
      ];
    });
  }

  removeItem(productId: number) {
    this.editItems.update((items) => items.filter((item) => item.productId !== productId));
  }

  updateItemField(item: any, field: 'quantity' | 'discountPercent' | 'unitPriceMkd', rawValue: string) {
    const numericValue = Number(rawValue === '' ? 0 : rawValue);
    if (Number.isNaN(numericValue) || numericValue < 0) return;
    if (field === 'quantity' && numericValue <= 0) {
      this.removeItem(item.productId);
      return;
    }

    this.editItems.update((items) =>
      items.map((cartItem) =>
        cartItem.productId === item.productId ? calculateItem({ ...cartItem, [field]: numericValue }) : cartItem,
      ),
    );
  }

  updateDocumentDateFromInput(value: string) {
    this.editHeaderForm.controls.documentDate.setValue(value ? new Date(value).toISOString() : '');
  }

  saveChanges() {
    const data = this.document();
    const id = this.route.snapshot.paramMap.get('id');
    if (!data || !id) return;

    const header = this.editHeaderForm.getRawValue();
    this.saving.set(true);

    this.salesService
      .updateSalesDocument(id, {
        ...data,
        documentType: header.documentType,
        documentDate: header.documentDate,
        customerId: header.customerId ? Number(header.customerId) : null,
        warehouseId: header.warehouseId ? Number(header.warehouseId) : null,
        paymentMethod: header.documentType === 'INVOICE' ? null : header.paymentMethod,
        description: header.description,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: async () => {
          try {
            const originalItems = data.items ?? [];
            const currentItems = this.editItems();

            for (const original of originalItems) {
              const stillExists = currentItems.find((item) => item.id === original.id);
              if (!stillExists) {
                await firstValueFrom(this.salesService.deleteSalesItem(original.id));
              }
            }

            for (const item of currentItems) {
              const payload = {
                productId: item.productId,
                quantity: item.quantity,
                unitPriceMkd: item.unitPriceMkd,
                discountPercent: item.discountPercent,
              };

              if (item.id) {
                await firstValueFrom(this.salesService.updateSalesItem(item.id, payload));
              } else {
                await firstValueFrom(this.salesService.addSalesItem(id, payload));
              }
            }

            this.isEditMode.set(false);
            this.loadDocument();
            this.paymentPaidTotal.set(String(Number(calculateTotals(this.editItems()).totalAmount).toFixed(2)));
            this.redirectAfterPayment.set(true);
            this.paymentDialogOpen.set(true);
          } catch (error: any) {
            console.error(error);
            this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to save changes');
          }
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to save changes');
        },
      });
  }

  fiscalize() {
    const data = this.document();
    const id = this.route.snapshot.paramMap.get('id');
    if (!data || !id) return;

    if (data.fiscalized) {
      this.alerts.error('This document is already fiscalized.');
      return;
    }

    if (!this.alerts.confirm(`Are you sure you want to fiscalize document ${data.documentNumber}?`)) {
      return;
    }

    this.salesService
      .fiscalizeSalesDocument(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadDocument(),
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to fiscalize document');
        },
      });
  }

  deleteDocument() {
    const data = this.document();
    const id = this.route.snapshot.paramMap.get('id');
    if (!data || !id) return;

    if (!this.alerts.confirm(`Are you sure you want to delete document ${data.documentNumber}?`)) {
      return;
    }

    this.salesService
      .deleteSalesDocument(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => void this.router.navigate(['/sales/list']),
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to delete document');
        },
      });
  }

  openPaymentDialog() {
    const data = this.document();
    if (!data) return;
    this.paymentPaidTotal.set(String(Number(data.paidTotal ?? 0).toFixed(2)));
    this.redirectAfterPayment.set(false);
    this.paymentDialogOpen.set(true);
  }

  confirmPayment() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.paymentSaving.set(true);
    this.salesService
      .updatePayment(id, Number(this.paymentPaidTotal()))
      .pipe(
        finalize(() => this.paymentSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.paymentDialogOpen.set(false);
          this.loadDocument();
          if (this.redirectAfterPayment()) {
            void this.router.navigate(['/sales/list']);
          }
        },
        error: (error) => {
          console.error(error);
          this.alerts.error(error?.error?.message ?? error?.error ?? 'Failed to update payment');
        },
      });
  }

  previewPdf() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.salesService.getSalesPdf(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
      },
      error: (error) => {
        console.error(error);
        this.alerts.error('Failed to preview PDF');
      },
    });
  }

  downloadPdf() {
    const id = this.route.snapshot.paramMap.get('id');
    const data = this.document();
    if (!id || !data) return;
    this.salesService.getSalesPdf(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sales-document-${data.documentNumber ?? id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error(error);
        this.alerts.error('Failed to download PDF');
      },
    });
  }

  goToList() {
    void this.router.navigate(['/sales/list']);
  }

  cancelPaymentDialog() {
    this.paymentDialogOpen.set(false);
    if (this.redirectAfterPayment()) {
      this.goToList();
    }
  }

  get calculatedEditItems() {
    return this.editItems().map(calculateItem);
  }

  get editTotals() {
    return calculateTotals(this.calculatedEditItems);
  }

  get canFiscalize() {
    return Number(this.document()?.paidTotal ?? 0) >= Number(this.document()?.totalAmount ?? 0);
  }

  get remainingAmount() {
    return Number(this.document()?.totalAmount ?? 0) - Number(this.document()?.paidTotal ?? 0);
  }

  get paymentDialogTotalAmount() {
    return Number(this.document()?.totalAmount ?? 0);
  }

  setPaymentFull() {
    this.paymentPaidTotal.set(String(this.paymentDialogTotalAmount.toFixed(2)));
  }

  readonly formatDate = formatDateTime;
  readonly formatMoney = formatMoney;
  readonly toDateTimeLocalValue = toDateTimeLocalValue;
}
