import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize, firstValueFrom } from 'rxjs';
import { InventoryService } from '../../core/services/inventory.service';
import { LookupService } from '../../core/services/lookup.service';
import { SupplyService } from '../../core/services/supply.service';
import { UiAlertService } from '../../core/services/ui-alert.service';

@Component({
  selector: 'app-supply-editor-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './supply-editor-page.component.html',
})
export class SupplyEditorPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly lookupService = inject(LookupService);
  private readonly supplyService = inject(SupplyService);
  private readonly alerts = inject(UiAlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly productSearchLoading = signal(false);
  readonly productSearchError = signal(false);
  readonly warehouses = signal<any[]>([]);
  readonly suppliers = signal<any[]>([]);
  readonly supplyDocument = signal<any | null>(null);
  readonly createdSupplyDocumentId = signal<number | null>(null);
  readonly products = signal<any[]>([]);

  readonly form = this.fb.nonNullable.group({
    search: [''],
    selectedWarehouseId: [''],
    selectedSupplierId: [''],
    documentDate: [''],
    invoiceNumber: [''],
    invoiceDate: [''],
    exchangeRate: ['61.5'],
    m1Percent: ['26'],
    m2Percent: ['95'],
    note: [''],
  });

  constructor() {
    this.loadLookups();
    this.loadDocumentIfNeeded();

    this.form.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.searchProducts(value));
  }

  get routeSupplyDocumentId() {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? Number(id) : null;
  }

  get supplyDocumentId() {
    return this.routeSupplyDocumentId ?? this.createdSupplyDocumentId();
  }

  get isConfirmed() {
    return this.supplyDocument()?.status === 'CONFIRMED';
  }

  get items() {
    return this.supplyDocument()?.items ?? [];
  }

  get selectedWarehouseId() {
    return Number(
      this.form.controls.selectedWarehouseId.getRawValue() ||
        this.supplyDocument()?.warehouseId ||
        this.warehouses()[0]?.id ||
        0,
    );
  }

  get selectedSupplierId() {
    return Number(
      this.form.controls.selectedSupplierId.getRawValue() ||
        this.supplyDocument()?.supplierId ||
        this.suppliers()[0]?.id ||
        0,
    );
  }

  get totals() {
    const rows = this.items;
    return {
      purchase: rows.reduce((sum: number, item: any) => sum + Number(item.totalPurchaseValueMkd ?? 0), 0),
      retail: rows.reduce((sum: number, item: any) => sum + Number(item.totalRetailValueMkd ?? 0), 0),
    };
  }

  loadLookups() {
    this.lookupService
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: any) => this.warehouses.set(response?.content ?? response ?? []));

    this.lookupService
      .getSuppliers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: any) => this.suppliers.set(response?.content ?? response ?? []));
  }

  loadDocumentIfNeeded() {
    if (!this.routeSupplyDocumentId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.supplyService
      .getSupplyDocument(this.routeSupplyDocumentId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (document) => {
          this.supplyDocument.set(document);
          this.patchFormFromDocument(document);
        },
        error: (error) => {
          console.error(error);
          this.alerts.error('Failed to load supply document');
        },
      });
  }

  patchFormFromDocument(document: any) {
    this.form.patchValue({
      selectedWarehouseId: document?.warehouseId != null ? String(document.warehouseId) : '',
      selectedSupplierId: document?.supplierId != null ? String(document.supplierId) : '',
      documentDate: document?.documentDate?.slice?.(0, 10) ?? '',
      invoiceNumber: document?.invoiceNumber ?? '',
      invoiceDate: document?.invoiceDate?.slice?.(0, 10) ?? '',
      exchangeRate: String(document?.exchangeRate ?? 61.5),
      m1Percent: String(document?.m1Percent ?? 26),
      m2Percent: String(document?.m2Percent ?? 95),
      note: document?.note ?? '',
    }, { emitEvent: false });
  }

  searchProducts(value: string) {
    if (!value.trim() || !this.selectedWarehouseId) {
      this.products.set([]);
      return;
    }

    this.productSearchLoading.set(true);
    this.productSearchError.set(false);
    this.inventoryService
      .posSearchProducts({
        q: value,
        warehouseId: this.selectedWarehouseId,
        page: 0,
        size: 20,
      })
      .pipe(
        finalize(() => this.productSearchLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.products.set(response?.content ?? []),
        error: (error) => {
          console.error(error);
          this.productSearchError.set(true);
        },
      });
  }

  async ensureDraftDocument() {
    if (this.supplyDocumentId) return this.supplyDocumentId;

    if (!this.selectedWarehouseId) throw new Error('Please select a warehouse first');
    if (!this.selectedSupplierId) throw new Error('Please select a supplier first');

    const raw = this.form.getRawValue();
    const created = await firstValueFrom(
      this.supplyService.createSupplyDocument({
        supplierId: this.selectedSupplierId,
        warehouseId: this.selectedWarehouseId,
        documentDate: raw.documentDate || new Date().toISOString().slice(0, 10),
        invoiceNumber: raw.invoiceNumber,
        invoiceDate: raw.invoiceDate || new Date().toISOString().slice(0, 10),
        exchangeRate: Number(raw.exchangeRate || 61.5),
        m1Percent: Number(raw.m1Percent || 26),
        m2Percent: Number(raw.m2Percent || 95),
        note: raw.note,
        items: [],
      }),
    );

    this.createdSupplyDocumentId.set(created.id);
    this.supplyDocument.set(created);
    await this.router.navigate(['/supplies', created.id], { replaceUrl: true });
    this.patchFormFromDocument(created);
    return created.id as number;
  }

  async saveHeader() {
    try {
      this.busy.set(true);
      const docId = await this.ensureDraftDocument();
      const current = this.supplyDocument() ?? (await firstValueFrom(this.supplyService.getSupplyDocument(docId)));
      const raw = this.form.getRawValue();
      const updated = await firstValueFrom(
        this.supplyService.updateSupplyDocument(docId, {
          ...current,
          supplierId: this.selectedSupplierId,
          warehouseId: this.selectedWarehouseId,
          documentDate: raw.documentDate,
          invoiceNumber: raw.invoiceNumber,
          invoiceDate: raw.invoiceDate,
          exchangeRate: Number(raw.exchangeRate || 61.5),
          m1Percent: Number(raw.m1Percent || 26),
          m2Percent: Number(raw.m2Percent || 95),
          note: raw.note,
        }),
      );
      this.supplyDocument.set(updated);
      this.patchFormFromDocument(updated);
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to update supply header');
    } finally {
      this.busy.set(false);
    }
  }

  async addItem(product: any) {
    try {
      this.busy.set(true);
      const docId = await this.ensureDraftDocument();
      const current =
        this.supplyDocument() && this.supplyDocument()!.id === docId
          ? this.supplyDocument()
          : await firstValueFrom(this.supplyService.getSupplyDocument(docId));

      const existing = current?.items?.find((item: any) => item.productId === product.id);

      if (existing) {
        await firstValueFrom(
          this.supplyService.updateSupplyItem(existing.id, {
            ...existing,
            quantity: Number(existing.quantity) + 1,
          }),
        );
      } else {
        await firstValueFrom(
          this.supplyService.addSupplyItem(docId, {
            productId: product.id,
            quantity: 1,
            supplierUnitPriceEur: 0,
            note: '',
          }),
        );
      }

      await this.reloadDocument(docId);
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to add item');
    } finally {
      this.busy.set(false);
    }
  }

  async updateItem(item: any, field: 'quantity' | 'supplierUnitPriceEur', rawValue: string) {
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) return;

    if (field === 'quantity' && numericValue <= 0) {
      await this.removeItem(item.id);
      return;
    }

    try {
      this.busy.set(true);
      await firstValueFrom(
        this.supplyService.updateSupplyItem(item.id, {
          ...item,
          [field]: numericValue,
        }),
      );
      if (this.supplyDocumentId) {
        await this.reloadDocument(this.supplyDocumentId);
      }
    } catch (error) {
      console.error(error);
      this.alerts.error(`Failed to update ${field === 'quantity' ? 'quantity' : 'supplier price'}`);
    } finally {
      this.busy.set(false);
    }
  }

  async removeItem(itemId: number) {
    try {
      this.busy.set(true);
      await firstValueFrom(this.supplyService.deleteSupplyItem(itemId));
      if (this.supplyDocumentId) {
        await this.reloadDocument(this.supplyDocumentId);
      }
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to remove item');
    } finally {
      this.busy.set(false);
    }
  }

  async confirmSupply() {
    if (!this.supplyDocumentId) {
      this.alerts.error('No supply document to confirm');
      return;
    }

    try {
      this.busy.set(true);
      await firstValueFrom(this.supplyService.confirmSupplyDocument(this.supplyDocumentId));
      this.alerts.success('Supply confirmed successfully');
      await this.router.navigate(['/supplies']);
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to confirm supply');
    } finally {
      this.busy.set(false);
    }
  }

  async reopenSupply() {
    if (!this.supplyDocumentId) return;

    try {
      this.busy.set(true);
      await firstValueFrom(this.supplyService.reopenSupplyDocument(this.supplyDocumentId));
      await this.reloadDocument(this.supplyDocumentId);
      this.alerts.success('Supply reopened successfully');
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to reopen supply');
    } finally {
      this.busy.set(false);
    }
  }

  async deleteDraft() {
    if (!this.supplyDocumentId) return;
    if (!this.alerts.confirm('Are you sure you want to delete this draft supply?')) return;

    try {
      this.busy.set(true);
      await firstValueFrom(this.supplyService.deleteSupplyDocument(this.supplyDocumentId));
      this.alerts.success('Supply deleted successfully');
      await this.router.navigate(['/supplies']);
    } catch (error) {
      console.error(error);
      this.alerts.error('Failed to delete supply');
    } finally {
      this.busy.set(false);
    }
  }

  previewPdf() {
    if (!this.supplyDocumentId) return;
    this.supplyService.getSupplyPdf(this.supplyDocumentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    if (!this.supplyDocumentId) return;
    this.supplyService.getSupplyPdf(this.supplyDocumentId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `supply-document-${this.supplyDocument()?.documentNumber ?? this.supplyDocumentId}.pdf`;
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

  async reloadDocument(id: number) {
    const document = await firstValueFrom(this.supplyService.getSupplyDocument(id));
    this.supplyDocument.set(document);
    this.patchFormFromDocument(document);
  }

  goBackToDraftSupplies() {
    void this.router.navigate(['/supplies']);
  }
}
