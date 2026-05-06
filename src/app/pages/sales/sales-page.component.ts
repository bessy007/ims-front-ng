import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize, firstValueFrom } from 'rxjs';
import { CustomersService } from '../../core/services/customers.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LookupService } from '../../core/services/lookup.service';
import { SalesService } from '../../core/services/sales.service';
import { UiAlertService } from '../../core/services/ui-alert.service';
import { round2, toDateTimeLocalValue } from '../../shared/utils/formatters';
import { SalesPaymentDialogComponent } from '../../shared/components/sales-payment-dialog.component';

function calculateCartItem(item: any) {
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

function calculateDocumentTotals(items: any[]) {
  const subtotal = round2(
    items.reduce(
      (sum, item) => sum + Number(item.unitPriceMkd ?? 0) * Number(item.quantity ?? 0),
      0,
    ),
  );

  const discountAmount = round2(
    items.reduce(
      (sum, item) => sum + Number(item.discountAmountMkd ?? 0) * Number(item.quantity ?? 0),
      0,
    ),
  );

  return {
    subtotal,
    discountAmount,
    vatAmount: 0,
    totalAmount: round2(subtotal - discountAmount),
  };
}

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SalesPaymentDialogComponent],
  templateUrl: './sales-page.component.html',
})
export class SalesPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly inventoryService = inject(InventoryService);
  private readonly lookupService = inject(LookupService);
  private readonly salesService = inject(SalesService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loadingProducts = signal(false);
  readonly errorProducts = signal(false);
  readonly confirming = signal(false);
  readonly warehouses = signal<any[]>([]);
  readonly customers = signal<any[]>([]);
  readonly results = signal<any[]>([]);
  readonly cartItems = signal<any[]>([]);
  readonly confirmDialogOpen = signal(false);
  readonly zeroStockWarningOpen = signal(false);
  readonly zeroStockItems = signal<any[]>([]);
  readonly globalDiscount = signal('');
  readonly confirmPaidTotal = signal('0');
  readonly manualWarehouseId = signal<number | null>(null);

  readonly searchControl = this.fb.nonNullable.control('');
  readonly headerForm = this.fb.nonNullable.group({
    documentType: ['RETAIL'],
    documentDate: [new Date().toISOString()],
    customerId: [''],
    paymentMethod: ['CASH'],
    fiscalized: [false],
    description: [''],
  });

  constructor() {
    this.lookupService
      .getWarehouses(0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: any) => this.warehouses.set(response?.content ?? response ?? []));

    this.customersService
      .searchCustomers('', 0, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response) => this.customers.set(response?.content ?? response ?? []));

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchProducts(value));
  }

  get selectedWarehouseId() {
    return this.manualWarehouseId() ?? this.warehouses()[0]?.id ?? null;
  }

  get calculatedItems() {
    return this.cartItems().map(calculateCartItem);
  }

  get totals() {
    return calculateDocumentTotals(this.calculatedItems);
  }

  get documentType() {
    return this.headerForm.controls.documentType.getRawValue();
  }

  get remainingAmount() {
    return Number(this.totals.totalAmount ?? 0) - Number(this.confirmPaidTotal() || 0);
  }

  get paidAmount() {
    return Number(this.confirmPaidTotal() || 0);
  }

  searchProducts(value: string) {
    if (!value.trim() || !this.selectedWarehouseId) {
      this.results.set([]);
      return;
    }

    this.loadingProducts.set(true);
    this.errorProducts.set(false);
    this.inventoryService
      .posSearchProducts({
        q: value,
        warehouseId: this.selectedWarehouseId,
        page: 0,
        size: 20,
      })
      .pipe(
        finalize(() => this.loadingProducts.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.results.set(response?.content ?? []),
        error: (error) => {
          console.error(error);
          this.errorProducts.set(true);
        },
      });
  }

  resetSaleState() {
    this.searchControl.setValue('', { emitEvent: false });
    this.results.set([]);
    this.cartItems.set([]);
    this.globalDiscount.set('');
    this.confirmDialogOpen.set(false);
    this.confirmPaidTotal.set('0');
    this.zeroStockWarningOpen.set(false);
    this.zeroStockItems.set([]);
    this.headerForm.reset({
      documentType: 'RETAIL',
      documentDate: new Date().toISOString(),
      customerId: '',
      paymentMethod: 'CASH',
      fiscalized: false,
      description: '',
    });
  }

  changeWarehouse(warehouseId: number) {
    if (this.cartItems().length > 0) {
      const confirmed = this.alerts.confirm(
        'Changing warehouse will reset the current sale on screen. Continue?',
      );
      if (!confirmed) return;
    }

    this.manualWarehouseId.set(warehouseId);
    this.resetSaleState();
  }

  parseWarehouseId(value: string) {
    return Number(value);
  }

  changeDocumentType(documentType: string) {
    this.headerForm.patchValue({
      documentType,
      paymentMethod: documentType === 'INVOICE' ? 'CASH' : this.headerForm.controls.paymentMethod.getRawValue() || 'CASH',
    });
  }

  updateDocumentDate(value: string) {
    this.headerForm.controls.documentDate.setValue(
      value ? new Date(value).toISOString() : new Date().toISOString(),
    );
  }

  addToCart(product: any) {
    this.cartItems.update((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: round2(Number(item.quantity) + 1),
                stockQuantity: Number(product.stockQuantity ?? item.stockQuantity ?? 0),
              }
            : item,
        );
      }

      return [
        ...items,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPriceMkd: Number(product.retailPriceMkd ?? 0),
          discountPercent: 0,
          stockQuantity: Number(product.stockQuantity ?? 0),
        },
      ];
    });
  }

  removeItem(productId: number) {
    this.cartItems.update((items) => items.filter((item) => item.productId !== productId));
  }

  updateQuantity(item: any, nextQuantity: string | number) {
    if (nextQuantity === '') {
      this.cartItems.update((items) =>
        items.map((cartItem) =>
          cartItem.productId === item.productId ? { ...cartItem, quantity: 0 } : cartItem,
        ),
      );
      return;
    }

    const numericQuantity = Number(nextQuantity);
    if (Number.isNaN(numericQuantity)) return;
    if (numericQuantity <= 0) {
      this.removeItem(item.productId);
      return;
    }

    this.cartItems.update((items) =>
      items.map((cartItem) =>
        cartItem.productId === item.productId ? { ...cartItem, quantity: numericQuantity } : cartItem,
      ),
    );
  }

  decrementQuantity(item: any) {
    this.updateQuantity(item, Number(item.quantity) - 1);
  }

  incrementQuantity(item: any) {
    this.updateQuantity(item, Number(item.quantity) + 1);
  }

  updateDiscount(item: any, nextDiscount: string | number) {
    if (nextDiscount === '') {
      this.cartItems.update((items) =>
        items.map((cartItem) =>
          cartItem.productId === item.productId ? { ...cartItem, discountPercent: 0 } : cartItem,
        ),
      );
      return;
    }

    const numericDiscount = Number(nextDiscount);
    if (Number.isNaN(numericDiscount) || numericDiscount < 0) return;

    this.cartItems.update((items) =>
      items.map((cartItem) =>
        cartItem.productId === item.productId ? { ...cartItem, discountPercent: numericDiscount } : cartItem,
      ),
    );
  }

  updateUnitPrice(item: any, nextUnitPrice: string | number) {
    if (nextUnitPrice === '') {
      this.cartItems.update((items) =>
        items.map((cartItem) =>
          cartItem.productId === item.productId ? { ...cartItem, unitPriceMkd: 0 } : cartItem,
        ),
      );
      return;
    }

    const numericUnitPrice = Number(nextUnitPrice);
    if (Number.isNaN(numericUnitPrice) || numericUnitPrice < 0) return;

    this.cartItems.update((items) =>
      items.map((cartItem) =>
        cartItem.productId === item.productId ? { ...cartItem, unitPriceMkd: numericUnitPrice } : cartItem,
      ),
    );
  }

  applyGlobalDiscount() {
    const numericDiscount = this.globalDiscount() === '' ? 0 : Number(this.globalDiscount());
    if (Number.isNaN(numericDiscount) || numericDiscount < 0) {
      this.alerts.error('Global discount must be a valid non-negative number');
      return;
    }

    this.cartItems.update((items) =>
      items.map((item) => ({
        ...item,
        discountPercent: numericDiscount,
      })),
    );
  }

  openConfirmDialog() {
    this.confirmPaidTotal.set(String(Number(this.totals.totalAmount ?? 0).toFixed(2)));
    this.confirmDialogOpen.set(true);
  }

  startConfirmSale() {
    if (!this.selectedWarehouseId) {
      this.alerts.error('Please select a warehouse first');
      return;
    }

    if (this.calculatedItems.length === 0) {
      this.alerts.error('No sales document to confirm');
      return;
    }

    const zeroStock = this.calculatedItems.filter((item) => Number(item.stockQuantity ?? 0) <= 0);
    if (zeroStock.length > 0) {
      this.zeroStockItems.set(zeroStock);
      this.zeroStockWarningOpen.set(true);
      return;
    }

    this.openConfirmDialog();
  }

  async confirmSale() {
    try {
      this.confirming.set(true);

      if (!this.selectedWarehouseId) {
        throw new Error('Please select a warehouse first');
      }

      if (this.calculatedItems.length === 0) {
        throw new Error('No sales document to confirm');
      }

      const paidTotalNumber = Number(this.confirmPaidTotal());
      if (Number.isNaN(paidTotalNumber) || paidTotalNumber < 0) {
        throw new Error('Paid total must be a valid non-negative number');
      }

      if (paidTotalNumber > Number(this.totals.totalAmount ?? 0)) {
        throw new Error('Paid total cannot exceed total amount');
      }

      const header = this.headerForm.getRawValue();
      const createdDocument = await firstValueFrom(
        this.salesService.createSalesDocument({
          documentNumber: '',
          documentType: header.documentType,
          customerId: header.customerId ? Number(header.customerId) : null,
          warehouseId: this.selectedWarehouseId,
          documentDate: header.documentDate,
          discountPercent: 0,
          paymentMethod: header.documentType === 'INVOICE' ? null : header.paymentMethod,
          fiscalized: false,
          description: header.description,
        }),
      );

      for (const item of this.calculatedItems) {
        await firstValueFrom(
          this.salesService.addSalesItem(createdDocument.id, {
            productId: item.productId,
            quantity: item.quantity,
            unitPriceMkd: item.unitPriceMkd,
            discountPercent: item.discountPercent,
          }),
        );
      }

      await firstValueFrom(this.salesService.updatePayment(createdDocument.id, paidTotalNumber));
      await firstValueFrom(this.salesService.confirmSalesDocument(createdDocument.id));

      this.alerts.success('Sale confirmed successfully');
      this.resetSaleState();
    } catch (error: any) {
      console.error(error);
      this.alerts.error(error?.error?.message ?? error?.error ?? error?.message ?? 'Failed to confirm sale');
    } finally {
      this.confirming.set(false);
    }
  }

  async printOffer() {
    if (this.calculatedItems.length === 0) return;

    try {
      const header = this.headerForm.getRawValue();
      const blob = await firstValueFrom(
        this.salesService.getSalesOfferPdf({
          documentNumber: '',
          documentType: header.documentType,
          customerId: header.customerId ? Number(header.customerId) : null,
          warehouseId: this.selectedWarehouseId,
          documentDate: header.documentDate,
          discountPercent: 0,
          subtotal: this.totals.subtotal,
          discountAmount: this.totals.discountAmount,
          vatAmount: this.totals.vatAmount,
          totalAmount: this.totals.totalAmount,
          paidTotal: 0,
          paymentMethod: header.documentType === 'INVOICE' ? null : header.paymentMethod,
          fiscalized: false,
          status: 'DRAFT',
          description: header.description,
          items: this.calculatedItems.map((item) => ({
            id: null,
            salesDocumentId: null,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPriceMkd: item.unitPriceMkd,
            discountPercent: item.discountPercent,
            discountAmountMkd: item.discountAmountMkd,
            finalUnitPriceMkd: item.finalUnitPriceMkd,
            lineTotalMkd: item.lineTotalMkd,
            createdAt: null,
            updatedAt: null,
          })),
          paidDate: null,
          createdAt: null,
          updatedAt: null,
        }),
      );

      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');

      const shouldContinue = this.alerts.confirm(
        'Do you want to continue the sale with the same products?',
      );

      if (!shouldContinue) {
        this.resetSaleState();
      }
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to generate offer PDF');
    }
  }

  getRequestedQuantity(item: any) {
    return Number(item.quantity ?? 0).toFixed(2);
  }

  getCurrentStock(item: any) {
    return Number(item.stockQuantity ?? 0).toFixed(2);
  }

  setConfirmPaidTotalFull() {
    this.confirmPaidTotal.set(String(this.totals.totalAmount.toFixed(2)));
  }

  readonly toDateTimeLocalValue = toDateTimeLocalValue;
}
