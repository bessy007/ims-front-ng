import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() brands: any[] = [];
  @Input() categories: any[] = [];
  @Input() initialValues: any = null;
  @Input() saving = false;
  @Input() submitLabel = 'Save Product';
  @Input() variant: 'default' | 'drawer' = 'default';

  @Output() submitted = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  readonly form = this.fb.nonNullable.group({
    id: [''],
    name: ['', Validators.required],
    articleNumber: ['', Validators.required],
    tecdocArticleId: [''],
    tecdocImageUrl: [''],
    tecdocSupplierId: [''],
    barcode: [''],
    brandId: ['', Validators.required],
    categoryId: ['', Validators.required],
    shelf: [''],
    packagingQuantity: ['1'],
    lastSupplierPriceEur: [''],
    lastPurchasePriceMkd: [''],
    retailPriceMkd: [''],
    vatRate: ['18', Validators.required],
    description: [''],
    active: [true],
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialValues']) {
      const values = this.initialValues;
      this.form.reset({
        id: values?.id != null ? String(values.id) : '',
        name: values?.name ?? '',
        articleNumber: values?.articleNumber ?? '',
        tecdocArticleId: values?.tecdocArticleId != null ? String(values.tecdocArticleId) : '',
        tecdocImageUrl: values?.tecdocImageUrl ?? '',
        tecdocSupplierId: values?.tecdocSupplierId != null ? String(values.tecdocSupplierId) : '',
        barcode: values?.barcode ?? '',
        brandId: values?.brandId != null ? String(values.brandId) : '',
        categoryId: values?.categoryId != null ? String(values.categoryId) : '',
        shelf: values?.shelf ?? '',
        packagingQuantity: values?.packagingQuantity != null ? String(values.packagingQuantity) : '1',
        lastSupplierPriceEur: values?.lastSupplierPriceEur != null ? String(values.lastSupplierPriceEur) : '',
        lastPurchasePriceMkd: values?.lastPurchasePriceMkd != null ? String(values.lastPurchasePriceMkd) : '',
        retailPriceMkd: values?.retailPriceMkd != null ? String(values.retailPriceMkd) : '',
        vatRate: values?.vatRate != null ? String(values.vatRate) : '18',
        description: values?.description ?? '',
        active: values?.active ?? true,
      }, { emitEvent: false });
    }
  }

  get isEditMode() {
    return !!this.initialValues?.id;
  }

  submit() {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.submitted.emit({
      name: raw.name.trim() || null,
      articleNumber: raw.articleNumber.trim() || null,
      tecdocArticleId: raw.tecdocArticleId === '' ? null : Number(raw.tecdocArticleId),
      tecdocImageUrl: raw.tecdocImageUrl.trim() || null,
      tecdocSupplierId: raw.tecdocSupplierId === '' ? null : Number(raw.tecdocSupplierId),
      barcode: raw.barcode.trim() || null,
      brandId: Number(raw.brandId),
      categoryId: Number(raw.categoryId),
      supplierId: null,
      shelf: raw.shelf.trim() || null,
      packagingQuantity: raw.packagingQuantity === '' ? 1 : Number(raw.packagingQuantity),
      lastSupplierPriceEur: raw.lastSupplierPriceEur === '' ? null : Number(raw.lastSupplierPriceEur),
      lastPurchasePriceMkd: this.isEditMode && raw.lastPurchasePriceMkd !== '' ? Number(raw.lastPurchasePriceMkd) : null,
      retailPriceMkd: raw.retailPriceMkd === '' ? null : Number(raw.retailPriceMkd),
      vatRate: raw.vatRate === '' ? null : Number(raw.vatRate),
      description: raw.description.trim() || null,
      active: !!raw.active,
      oemNumbers: this.initialValues?.oemNumbers ?? [],
    });
  }
}
